"""Headless Blender 4.3 4-view contact sheet renderer and Draco GLB optimizer.

Usage:
  "C:/Program Files/Blender Foundation/Blender 4.3/blender.exe" --background --python render_4view.py -- <input.glb> <output_sheet.png> [--draco-out <out.glb>]
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    parser = argparse.ArgumentParser(description="Render 4-view sheet and optionally Draco-export a GLB.")
    parser.add_argument("input_glb", help="Path to input .glb / .gltf")
    parser.add_argument("output_sheet", help="Path to output 1024x1024 4-view PNG")
    parser.add_argument("--draco-out", default=None, help="Optional Draco-compressed .glb output path")
    return parser.parse_args(argv)


def look_at_matrix(cam_pos: Vector, target: Vector, world_up: Vector) -> Matrix:
    fwd = (target - cam_pos).normalized()
    right = fwd.cross(world_up)
    if right.length < 1e-6:
        right = Vector((1.0, 0.0, 0.0))
    else:
        right.normalize()
    cam_up = right.cross(fwd).normalized()
    return Matrix((right, cam_up, -fwd)).transposed()


def configure_workbench(scene: bpy.types.Scene) -> None:
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    shading.show_object_outline = True
    shading.object_outline_color = (0.08, 0.12, 0.18)
    shading.background_type = "VIEWPORT"
    shading.background_color = (0.95, 0.96, 0.98)

    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"


def compute_scene_bounds(mesh_objects: list[bpy.types.Object]) -> tuple[Vector, Vector, int]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    min_pt = Vector((float("inf"), float("inf"), float("inf")))
    max_pt = Vector((float("-inf"), float("-inf"), float("-inf")))
    tri_count = 0

    for obj in mesh_objects:
        eval_obj = obj.evaluated_get(depsgraph)
        mesh = eval_obj.to_mesh()
        mesh.calc_loop_triangles()
        tri_count += len(mesh.loop_triangles)
        for v in mesh.vertices:
            wp = eval_obj.matrix_world @ v.co
            min_pt.x = min(min_pt.x, wp.x)
            min_pt.y = min(min_pt.y, wp.y)
            min_pt.z = min(min_pt.z, wp.z)
            max_pt.x = max(max_pt.x, wp.x)
            max_pt.y = max(max_pt.y, wp.y)
            max_pt.z = max(max_pt.z, wp.z)
        eval_obj.to_mesh_clear()

    if not mesh_objects or min_pt.x == float("inf"):
        return Vector((-0.5, -0.5, -0.5)), Vector((0.5, 0.5, 0.5)), 0
    return min_pt, max_pt, tri_count


def stitch_contact_sheet(view_paths: list[Path], out_path: Path) -> None:
    tile = 512
    sheet = np.zeros((tile * 2, tile * 2, 4), dtype=np.float32)

    # Image.pixels rows run bottom -> top:
    # row 1 (y: 512..1024) = top row [Iso, Front]; row 0 (y: 0..512) = bottom row [Right, Top]
    placements = [
        (tile, tile * 2, 0, tile),       # 0: Isometric (top-left)
        (tile, tile * 2, tile, tile * 2),  # 1: Front (top-right)
        (0, tile, 0, tile),              # 2: Right (bottom-left)
        (0, tile, tile, tile * 2),       # 3: Top (bottom-right)
    ]

    for img_path, (y0, y1, x0, x1) in zip(view_paths, placements):
        loaded = bpy.data.images.load(str(img_path), check_existing=False)
        arr = np.empty(tile * tile * 4, dtype=np.float32)
        loaded.pixels.foreach_get(arr)
        sheet[y0:y1, x0:x1, :] = arr.reshape((tile, tile, 4))
        bpy.data.images.remove(loaded)

    divider = np.array([0.78, 0.81, 0.86, 1.0], dtype=np.float32)
    sheet[tile - 1 : tile + 1, :, :] = divider
    sheet[:, tile - 1 : tile + 1, :] = divider

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_img = bpy.data.images.new("contact_sheet", width=tile * 2, height=tile * 2, alpha=True)
    out_img.pixels.foreach_set(sheet.ravel())
    out_img.filepath_raw = str(out_path)
    out_img.file_format = "PNG"
    out_img.save()
    bpy.data.images.remove(out_img)


def main() -> None:
    args = parse_args()
    in_glb = Path(args.input_glb).resolve()
    out_sheet = Path(args.output_sheet).resolve()
    if not in_glb.exists():
        raise FileNotFoundError(f"Input GLB not found: {in_glb}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(in_glb))

    mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    min_pt, max_pt, tri_count = compute_scene_bounds(mesh_objs)
    size = max_pt - min_pt
    center = (min_pt + max_pt) * 0.5
    max_extent = max(size.x, size.y, size.z, 1e-3)
    radius = max(size.length * 0.5, 1e-3)

    print(f"Imported GLB: {in_glb.name}")
    print(f"Mesh count: {len(mesh_objs)}, Triangles: {tri_count}")
    print(f"World BBox Size (m): ({size.x:.4f}, {size.y:.4f}, {size.z:.4f})")
    print("Mesh nodes:", ", ".join(o.name for o in mesh_objs[:40]))

    scene = bpy.context.scene
    configure_workbench(scene)

    cam_data = bpy.data.cameras.new("RenderCam")
    cam_obj = bpy.data.objects.new("RenderCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    ortho_scale = max_extent * 1.38
    ortho_dist = max(max_extent * 3.0, radius * 2.5)
    persp_dist = max(max_extent * 2.15, radius * 2.75)

    views = [
        ("iso", "PERSP", Vector((0.65, -0.75, 0.52)).normalized() * persp_dist, Vector((0.0, 0.0, 1.0))),
        ("front", "ORTHO", Vector((0.0, -ortho_dist, 0.0)), Vector((0.0, 0.0, 1.0))),
        ("right", "ORTHO", Vector((ortho_dist, 0.0, 0.0)), Vector((0.0, 0.0, 1.0))),
        ("top", "ORTHO", Vector((0.0, 0.0, ortho_dist)), Vector((0.0, 1.0, 0.0))),
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        rendered_paths: list[Path] = []
        for label, cam_type, offset, up_vec in views:
            cam_pos = center + offset
            dist = offset.length
            cam_data.type = cam_type
            cam_data.lens = 38.0
            cam_data.ortho_scale = ortho_scale
            cam_data.clip_start = max(0.0005, dist * 0.01)
            cam_data.clip_end = max(1000.0, dist * 20.0)

            cam_obj.location = cam_pos
            rot = look_at_matrix(cam_pos, center, up_vec)
            cam_obj.rotation_euler = rot.to_euler()

            frame_path = Path(tmpdir) / f"{label}.png"
            scene.render.filepath = str(frame_path)
            bpy.ops.render.render(write_still=True)
            rendered_paths.append(frame_path)

        stitch_contact_sheet(rendered_paths, out_sheet)
        print(f"4-view contact sheet saved: {out_sheet}")

    bpy.data.objects.remove(cam_obj, do_unlink=True)
    bpy.data.cameras.remove(cam_data)

    if args.draco_out:
        draco_path = Path(args.draco_out).resolve()
        draco_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(
            filepath=str(draco_path),
            export_format="GLB",
            export_yup=True,
            export_apply=True,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
            export_materials="EXPORT",
            export_extras=False,
        )
        out_kb = os.path.getsize(draco_path) / 1024.0
        print(f"Draco GLB written: {draco_path} ({out_kb:.1f} KB)")


if __name__ == "__main__":
    main()
