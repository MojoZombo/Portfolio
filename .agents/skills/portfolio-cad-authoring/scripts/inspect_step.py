"""Coarse STEP inspection utility for clean-room portfolio CAD modeling.

Extracts outer assembly dimensions, aspect ratios normalized to max extent, and
largest top-level solids without dumping proprietary hole/fastener detail.
Optionally exports a coarse preview GLB for multi-angle visual inspection.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from build123d import Compound, Unit, export_gltf, import_step


def format_vec(x: float, y: float, z: float) -> str:
    return f"({x:.2f}, {y:.2f}, {z:.2f})"


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect a STEP file and extract coarse envelope ratios.")
    parser.add_argument("input_step", help="Path to input .step / .stp file")
    parser.add_argument("--preview-glb", default=None, help="Optional output path for coarse preview .glb")
    parser.add_argument("--max-parts", type=int, default=30, help="Max solids to print sorted by bbox volume")
    args = parser.parse_args()

    step_path = Path(args.input_step).resolve()
    if not step_path.exists():
        raise FileNotFoundError(f"STEP file not found: {step_path}")

    shape = import_step(str(step_path))
    bb = shape.bounding_box()
    size = bb.size
    center = bb.center()
    max_dim = max(size.X, size.Y, size.Z, 1e-6)

    solids = list(shape.solids()) if hasattr(shape, "solids") else []
    print(f"File: {step_path.name}")
    print(f"Solids count: {len(solids)}")
    print(f"Bounding Box Size (mm): X={size.X:.2f}, Y={size.Y:.2f}, Z={size.Z:.2f}")
    print(
        f"Aspect Ratios (max=1.0): X={size.X / max_dim:.3f}, Y={size.Y / max_dim:.3f}, Z={size.Z / max_dim:.3f}"
    )
    print(f"Envelope Center (mm): {format_vec(center.X, center.Y, center.Z)}")

    entries: list[tuple[float, str, tuple[float, float, float], tuple[float, float, float]]] = []
    for i, solid in enumerate(solids):
        s_bb = solid.bounding_box()
        s_size = s_bb.size
        s_center = s_bb.center()
        vol_box = s_size.X * s_size.Y * s_size.Z
        label = getattr(solid, "label", "") or f"solid_{i}"
        entries.append(
            (
                vol_box,
                str(label),
                (s_size.X, s_size.Y, s_size.Z),
                (s_center.X - center.X, s_center.Y - center.Y, s_center.Z - center.Z),
            )
        )

    entries.sort(key=lambda item: item[0], reverse=True)
    shown = entries[: max(1, args.max_parts)]
    print(f"\nTop {len(shown)} solids by bounding-box volume:")
    for rank, (_, label, s_dim, rel_c) in enumerate(shown, start=1):
        print(
            f"  {rank:2d}. {label:<28} size={format_vec(*s_dim)} mm  rel_center={format_vec(*rel_c)} mm"
        )

    if args.preview_glb:
        out_glb = Path(args.preview_glb).resolve()
        out_glb.parent.mkdir(parents=True, exist_ok=True)
        export_target: Any = shape if isinstance(shape, Compound) else Compound(children=[shape])
        export_gltf(
            export_target,
            str(out_glb),
            unit=Unit.MM,
            binary=True,
            linear_deflection=0.5,
            angular_deflection=0.35,
        )
        size_kb = out_glb.stat().st_size / 1024.0
        print(f"\nCoarse preview GLB written: {out_glb} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
