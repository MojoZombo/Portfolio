---
name: portfolio-cad-authoring
description: >-
  Use this skill whenever the user provides reference CAD files (STEP, STL, OBJ, GLB),
  photos, or videos to design, clean-room rebuild, optimize, and integrate simplified
  mechanical 3D representations into this portfolio site.
---

# Portfolio CAD Authoring

Turn confidential or overly detailed mechanical references (STEP files, photos, videos)
into clean-room, lightweight, portfolio-ready `.glb` assemblies tailored for this
site's cel/blueprint renderer and `#studio` / `#baker` pipeline.

## Private Workspace Layout

All proprietary references, intermediate builds, Python environment, and preview PNGs
live inside `cad-workspace/` (git-ignored and Vite-ignored):

- `cad-workspace/refs/<project>/` — Drop raw STEP files, photos, and videos here (`tesla`, `inductive`, `raise`, etc.). Never commit or copy raw references into `public/`.
- `cad-workspace/build/` — Clean-room `build123d` Python scripts (`*_clean.py`).
- `cad-workspace/previews/` — Coarse STEP previews and 4-view PNG inspection sheets.
- `cad-workspace/.venv/` — Isolated Python 3.12 environment with `build123d`.

## Toolchain Paths (Windows)

- **Python (`build123d`):** `cad-workspace/.venv/Scripts/python.exe`
- **Blender 4.3 Headless:** `C:\Program Files\Blender Foundation\Blender 4.3\blender.exe`
- **STEP Inspector:** [inspect_step.py](./scripts/inspect_step.py)
- **4-View Renderer & Draco Exporter:** [render_4view.py](./scripts/render_4view.py)

## Step-by-Step Authoring Workflow

### 1. Inspect References (Coarse Silhouette & Ratios Only)

- Read photos, screenshots, drawings, and short videos directly with `read_file`.
- For `.step` / `.stp` files, extract only outer bounding-box ratios, major sub-assembly positions, and a coarse preview GLB:
  ```powershell
  cad-workspace/.venv/Scripts/python.exe .agents/skills/portfolio-cad-authoring/scripts/inspect_step.py "cad-workspace/refs/<project>/model.step" --preview-glb "cad-workspace/previews/<project>_ref.glb"
  ```
- Render a 4-view inspection sheet from the coarse preview and view it with `read_file`:
  ```powershell
  & "C:\Program Files\Blender Foundation\Blender 4.3\blender.exe" --background --python .agents/skills/portfolio-cad-authoring/scripts/render_4view.py -- "cad-workspace/previews/<project>_ref.glb" "cad-workspace/previews/<project>_ref_4view.png"
  ```

### 2. Align on NDA Abstraction Before Modeling

Do **not** decimate or copy raw proprietary CAD meshes into `public/models/` (decimation can preserve internal geometry, exact fastener hole patterns, and proprietary node metadata).

Instead, propose a short **Keep vs. Abstract** plan with the user:
- **Keep:** Outer silhouette, aspect ratios, major telescoping/articulated sub-assemblies, crisp chamfers, and clean industrial color blocking.
- **Remove / Abstract:** Internal drivetrains, fasteners, screws, bolt circles, sensors/PCBs, company logos, exact bracket tolerances, and proprietary part names.

### 3. Build Clean-Room Model with `build123d`

Author a self-contained parametric script in `cad-workspace/build/<project>_clean.py`:
- Orient the exported assembly cleanly (`export_gltf(..., unit=Unit.M, binary=True, linear_deflection=0.002, angular_deflection=0.2)` — note `build123d` is Z-up; export upright or handle initial orientation cleanly in the model component/`#studio`).
- Assign **distinct semantic `.label`s and `.color`s** per moving/colored sub-assembly so [meshSplitter.ts](../../../src/utils/meshSplitter.ts) cleanly splits and animates parts:
  - Examples: `base_housing`, `stage_1`, `stage_2`, `chassis`, `wheel_fl`, `arm_shoulder`, `outrigger_cylinder`, `ram_rod`.
- Add subtle chamfers/fillets (`chamfer(...)` / `fillet(...)`) on major structural blocks so [cadEdges.ts](../../../src/canvas/cadEdges.ts) generates sharp engineering edge lines instead of boxy primitives.
- Keep target size scaled comfortably around ~1–3 units across.

### 4. Render 4-View Sheet & Export Draco GLB

Run headless Blender 4.3 to both verify geometry visually and export the compressed `.glb`:
```powershell
& "C:\Program Files\Blender Foundation\Blender 4.3\blender.exe" --background --python .agents/skills/portfolio-cad-authoring/scripts/render_4view.py -- "cad-workspace/previews/<project>_raw.glb" "cad-workspace/previews/<project>_4view.png" --draco-out "public/models/<ProjectClean>.glb"
```
Then **read `<project>_4view.png` with `read_file`** and verify:
- Proportions match the reference silhouette across Iso / Front / Right / Top views.
- Zero proprietary holes, bolts, or internals remain.
- Draco GLB size fits cleanly inside `~150–650 KB` in `public/models/`.

### 5. Wire Into Portfolio, Calibrate & Bake Posters

1. Update or create the model wrapper component in `src/canvas/models/`, register its path in [ModelPreloadManager.ts](../../../src/canvas/ModelPreloadManager.ts) (`MODEL_REGISTRY`), and ensure [ModelRenderer.tsx](../../../src/canvas/ModelRenderer.tsx) renders it cleanly with animated kinematics matching the real mechanism.
2. Adjust offset/rotation/scale/part colors/kinematics in `#studio` ([CADStudioWorkbench.tsx](../../../src/components/studio/CADStudioWorkbench.tsx)).
3. Regenerate 2x light & dark shaded/blueprint posters in `#baker`, bump `POSTER_VERSION` in [ModelPreloadManager.ts](../../../src/canvas/ModelPreloadManager.ts), and run `npx tsc --noEmit` + `npm run build`.
