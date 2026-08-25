# 3D CAD Models Directory

Place your `.glb` 3D files directly in this folder:
`public/models/`

### Example filenames:
- `public/models/robot-hand.glb`
- `public/models/cable-robot-2.glb`
- `public/models/ping-pong-robot.glb`
- `public/models/catamaran.glb`
- `public/models/drone-catch-winch.glb`
- `public/models/outrigger.glb`
- `public/models/modular-gripper.glb`
- `public/models/underwater-robot.glb`
- `public/models/anti-tangle-winch.glb`
- `public/models/bottle-scrubber.glb`
- `public/models/ftc-robot.glb`

Files placed here are served directly at `/models/<filename>.glb` by Vite and loaded via `@react-three/drei`'s `useGLTF('/models/<filename>.glb')`.
