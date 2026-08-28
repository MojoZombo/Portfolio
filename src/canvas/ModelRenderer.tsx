import React from 'react';
import { RobotHandModel } from './models/RobotHandModel';
import { CableRobotModel } from './models/CableRobotModel';
import { PingPongRobotModel } from './models/PingPongRobotModel';
import { CatamaranModel } from './models/CatamaranModel';
import { WinchCatchModel } from './models/WinchCatchModel';
import { OutriggerModel } from './models/OutriggerModel';
import { ModularGripperModel } from './models/ModularGripperModel';
import { UnderwaterRobotModel } from './models/UnderwaterRobotModel';
import { AntiTangleWinchModel } from './models/AntiTangleWinchModel';
import { BottleScrubberModel } from './models/BottleScrubberModel';
import { FTCRobotModel } from './models/FTCRobotModel';
import { TeslaActuatorModel } from './models/TeslaActuatorModel';
import { InductiveRobotModel } from './models/InductiveRobotModel';

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
