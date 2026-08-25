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

interface ModelRendererProps {
  modelType: string;
  isActive?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

export const ModelRenderer: React.FC<ModelRendererProps> = ({
  modelType,
  isActive = false,
  isHovered = false,
  isRotating = true,
}) => {
  switch (modelType) {
    case 'robot-hand':
      return <RobotHandModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'cable-robot-2':
      return <CableRobotModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'ping-pong':
      return <PingPongRobotModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'catamaran':
      return <CatamaranModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'drone-catch':
      return <WinchCatchModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'outrigger':
      return <OutriggerModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'modular-gripper':
      return <ModularGripperModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'underwater-robot':
      return <UnderwaterRobotModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'anti-tangle-winch':
      return <AntiTangleWinchModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'bottle-scrubber':
      return <BottleScrubberModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    case 'ftc-robot':
      return <FTCRobotModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
    default:
      return <RobotHandModel isActive={isActive} isHovered={isHovered} isRotating={isRotating} />;
  }
};
