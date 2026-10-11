import React, { lazy } from 'react';

// Each model is code-split and fetched on demand (rendered inside ModelViewer's <Suspense>)
const RobotHandModel = lazy(() => import('./models/RobotHandModel').then((m) => ({ default: m.RobotHandModel })));
const CableRobotModel = lazy(() => import('./models/CableRobotModel').then((m) => ({ default: m.CableRobotModel })));
const PingPongRobotModel = lazy(() => import('./models/PingPongRobotModel').then((m) => ({ default: m.PingPongRobotModel })));
const CatamaranModel = lazy(() => import('./models/CatamaranModel').then((m) => ({ default: m.CatamaranModel })));
const WinchCatchModel = lazy(() => import('./models/WinchCatchModel').then((m) => ({ default: m.WinchCatchModel })));
const OutriggerModel = lazy(() => import('./models/OutriggerModel').then((m) => ({ default: m.OutriggerModel })));
const ModularGripperModel = lazy(() => import('./models/ModularGripperModel').then((m) => ({ default: m.ModularGripperModel })));
const UnderwaterRobotModel = lazy(() => import('./models/UnderwaterRobotModel').then((m) => ({ default: m.UnderwaterRobotModel })));
const AntiTangleWinchModel = lazy(() => import('./models/AntiTangleWinchModel').then((m) => ({ default: m.AntiTangleWinchModel })));
const BottleScrubberModel = lazy(() => import('./models/BottleScrubberModel').then((m) => ({ default: m.BottleScrubberModel })));
const FTCRobotModel = lazy(() => import('./models/FTCRobotModel').then((m) => ({ default: m.FTCRobotModel })));
const TeslaActuatorModel = lazy(() => import('./models/TeslaActuatorModel').then((m) => ({ default: m.TeslaActuatorModel })));
const InductiveRobotModel = lazy(() => import('./models/InductiveRobotModel').then((m) => ({ default: m.InductiveRobotModel })));

interface ModelRendererProps {
  modelType: string;
  isActive?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
  isAnimating?: boolean;
}

export const ModelRenderer: React.FC<ModelRendererProps> = ({
  modelType,
  isActive = false,
  isHovered = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const props = { isActive, isHovered, isRotating, isAnimating };
  switch (modelType) {
    case 'tesla-actuator':
      return <TeslaActuatorModel {...props} />;
    case 'inductive-robot':
      return <InductiveRobotModel {...props} />;
    case 'robot-hand':
      return <RobotHandModel {...props} />;
    case 'cable-robot-2':
      return <CableRobotModel {...props} />;
    case 'ping-pong':
      return <PingPongRobotModel {...props} />;
    case 'catamaran':
      return <CatamaranModel {...props} />;
    case 'drone-catch':
      return <WinchCatchModel {...props} />;
    case 'outrigger':
      return <OutriggerModel {...props} />;
    case 'modular-gripper':
      return <ModularGripperModel {...props} />;
    case 'underwater-robot':
      return <UnderwaterRobotModel {...props} />;
    case 'anti-tangle-winch':
      return <AntiTangleWinchModel {...props} />;
    case 'bottle-scrubber':
      return <BottleScrubberModel {...props} />;
    case 'ftc-robot':
      return <FTCRobotModel {...props} />;
    default:
      return <RobotHandModel {...props} />;
  }
};
