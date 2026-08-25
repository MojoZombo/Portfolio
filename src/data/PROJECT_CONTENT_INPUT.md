# Project Content & Photo Input Guide

Use this document to paste or edit the exact verbatim text and photos from your Showspace portfolio (`https://showspace.so/s/jadenfann`).

All of these fields are directly mapped to [`src/data/projectsData.ts`](file:///c:/Users/Jaden%20Fann/Documents/Antigravity/Portfolio%20Site/src/data/projectsData.ts) and render inside the detailed engineering sheets on your portfolio.

---

## 1. Robot Humanoid Hand Mirroring (Dec 2024)
- **Title**: Robot Humanoid Hand Mirroring
- **Subtitle**: Sawyer Arm & 5-DOF Articulated End-Effector
- **Date**: Dec 2024
- **Tags**: `Robotics`, `Kinematics`, `Computer Vision`, `Tendon Drive`, `ROS2`
- **Verbatim Project Text**:
  ```text
  Full Website found here (https://sites.google.com/berkeley.edu/handymanny/introduction?authuser=0)

  Overview

  My team designed a robotic system which implements visual tracking to mirror a user’s hand and finger movements on a Sawyer arm and custom humanoid hand end effector. I designed the custom robotic hand to be integrated with a robotic arm and custom electronics, assisted with PCB design and assembly, as well as code integration.

  Background

  Humanoid robotics is a growing field of research and startups which leverage the adaptability of the human body for a wide variety of applications. Given the large corpus of data concerning human activities (videos, images, live sensing, etc.), robots can solve human-level tasks faster through imitation of humans. However, there’s a hole in the data concerning the force applied by human actions (Eg: how much force is needed to push a button? What is the compensation by the arm when using a certain tool?). Our goal is to augment the existing tools to map human motion with a measurement device for applied force to an object in the grasp of a human-like hand for use in pose estimation (and eventually extend to imitation learning more broadly).

  Goals

  Our initial ambitious goal was to create a glove worn by a human user with strain gauges and pressure sensors on the fingertips. The hand movements in space, finger movements, and forces would then be replicated on a custom robotic hand on a Sawyer robot. The force sensing goal was removed from the scope of the project due to integration time constraints. The force sensing electronics and software worked, but integration onto the custom hand was not feasible in our timeline.

  Mechanical Design

  Hand Base and Palm

  The main structure of the hand is manufactured using 3D-printed PLA. Holes route tension lines through the hand and to the phalanxes. All critical hardware and electronics for the hand, including the PCB and servos are mounted to this part using bolts and spacers. This part is designed to be structurally strong and mount securely to the Sawyer. The hand must be able to hold up to repeated testing without requiring extensive remanufacturing and reassembly. The fingers are mounted to secure slots next to angled faces to facilitate proper bending angle of each finger. Holes in the back line up with the PCB holes for servo wire routing.

  Phalanxes and Tension Lines

  Each finger is made up of 3 different sized phalanxes with tension line routing holes. Similar to the hand base, each phalanx has a 2 mounting slots for joints and angled faces for the ideal bending angle of each phalanx. When the tension lines are correctly routed through the phalanxes, shortening the length of the tension line through the phalanxes causes a motion similar to that of a human finger in flexion. The tension lines are securely tied to the final phalanx of each finger to keep tension.

  Finger joints

  Made of TPU (85A Shore Hardness) for the optimal balance of flexibility and elasticity and finger flexion behavior. Geometry clearances to securely fit inside of phalanx slots without any slipping.

  Micro Servos

  Five SG90 micro servos actuate the fingers using the tension line system. The tension lines are secured to the end of servo horns mounted to each micro servo output. 9G servo motors are used to meet the torque requirement for basic hand movements while being small enough to fit inside of the hand palm.

  https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/11556/story-robot-humanoid-hand-mirroring-G6Y5.png
  https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/11556/story-robot-humanoid-hand-mirroring-j1Ij.png
  https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/11556/story-robot-humanoid-hand-mirroring-3g5c.png

  Custom PCB

  Mounted on the back of the hand for servo power distribution, sensing, microcontroller, and communication. Regulates 12V power input to 5V, 1.5A output to the servos. Unfortunately, due to a small mistake in the circuit design, the microcontroller was unusable, so the circuit ended up only being used for power regulation. Sensing worked, but time limitations unfortunately meant it wasn't implemented in time. The PCB is mounted to the hand using bolts and spacers to ensure secure, stable mounting and leaving room for solder and wires underneath the board.
  https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/11556/story-robot-humanoid-hand-mirroring-weNx.JPG

  Design Limitations

  While simplifications made to the hand reduces complexity and increases reliability, it prevents a fully accurate representation of a human hand's range of motion. This limits the robotic hand’s applicability in tasks requiring nuanced thumb movements or fine motor skills, such as pinching or precision grips.

  Although the hand can perform basic tasks, such as gripping a solo cup, it struggles with more intricate or variable object shapes and sizes. In real-world engineering applications, this would limit its utility in environments requiring fine manipulation.

  Results

  The mechanical hand worked well, successfully actuating each finger to their desired flexion. The robot can consistently follow the user's hand position and mimic its rotation while estimating the user's joint angles.

  https://www.youtube.com/watch?v=9tvFBUCePyw
  https://www.youtube.com/watch?v=dH4k_KfnNgs

  Conclusion/Discussion

  The robotic hand successfully performed basic gripping tasks, such as holding a solo cup or objects with similar large diameters. However, the limited servo torque and DOF in the current robotic hand meant that gripping smaller and heavier objects was impossible. 

  The robot effectively mirrors user's movements onto the 3D plane, but there's also latency in movement to new positions. On occasions, with an outwardly simple movement to a new position, the Inverse Kinematics solution would lead the Sawyer Arm to rotate its linkages and take its time to reach the new position. 

  Future Improvements

  The next stage of the project is to integrate a single camera system capable of both hand orientation and location. We plan to also implement depth detection for mirroring movements in a 3D space, instead of a 2D plane. To accomplish that, however, we'd need to use a different camera, possibly with depth but with better resolution.

  We also aim to integrate pressure sensors and strain gauges into the robotic hand's fingers to improve robotic force control, gather gripping data applicable to research and accurately imitate the user's force in grabbing objects. This addition will allow the robotic hand to adjust its gripping force, allowing for effective manipulation of fragile objects (such as an egg).

  We would like to optimize the Inverse Kinematics solver and improve the camera, so that the lag between detecting movement and moving the arm can be fixed while possibly fixing the issue of certain poses taking extremely long routes to reach.

  Finally, increasing the degrees of freedom in the fingers and thumb can improve future robotic hands. By adding additional actuation points and types of joints, the robotic hand can achieve more human motion. The improved dexterity can mean improvements to handling and gripping tasks.

  Final Thoughts

  If given further time and resources, the project could become a highly functional robotic hand applicable in assistive technologies, research, or manufacturing. The project was originally inspired by Kind Humanoid Robotics, for precision applications of mimicking and robotic hand movements and grasp functionalities. Combining the hardware and software upgrades would significantly improve its precision, adaptability, and real-world applications.
  ```
- **Photos / Media File Paths or URLs**:
  - `src/assets/projects/robot-hand-1.jpg`
  - `src/assets/projects/robot-hand-2.jpg`

---

## 2. High Speed Cable Robot Iteration 2 (May 2024)
- **Title**: High Speed Cable Robot Iteration 2
- **Subtitle**: Planar Parallel Cable-Driven Robot
- **Date**: May 2024
- **Tags**: `Parallel Robotics`, `High Speed`, `Controls`, `Tension Dynamics`
- **Verbatim Project Text**:
  ```text
  Overview

I led the development of further iterations and testing of an 8'x8' high speed cable robot. The goal was to improve reliability and robustness in high speed and accurate movements, while increasing the size of the robot to the size of a shipping container. I led the team through every stage of the design process, keeping timelines, assigning tasks and reviewing designs to ensure quality and on-time deliverables. I also designed, manufactured, and assembled multiple components and mechanisms including winch plates and frame brackets.

Sentien’s current automated drone storage method requires a lengthy manipulation process after the drone lands, and isn’t capable of handling fixed wing drones.

Sentien’s suggested solution is a 2D cable robot the size of a shipping container that can accurately catch landing drones at high speeds.

Solution

Multiple mechanisms were simplified for increased reliability and reduced assembly difficulty. The robot frame was strengthened to hold up to high acceleration required to match the speed of landing fixed wing drones. Tensioners were designed to give some leeway in software control and prevent cable slack.

put the following next to eachother:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-NVBD.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-bf9X.png

1D Prototype

The 1D prototype was built in order to test mechanism designs without a large assembly space. The winches and tensioners were tested together and the results were used to redesign and iterate.

Follo9wing images next to eachother too:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-4Ub9.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-cuIc.png

FEA Validation was conducted on critical parts to ensure performance under worst case scenarios.

1D FEA images in carousel:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-cable-robot-iteration-2-1698.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-cable-robot-iteration-2-82FZ.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-cable-robot-iteration-2-ezkm.png

1D Prototyping carosel:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-fkhn.jpg
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-swKn.jpg
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-Yb6H.jpg


https://www.youtube.com/watch?v=wF_lyKvVXN0

2D Prototype

After multiple design iterations and many days of manufacturing, the full 2D prototype of the 8'x8' cable robot was assembled and tested.

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-p4xs.png

The tensioner was updated to include a tension sensor so that software-based tension control could be used in addition or instead of the mechanical tensioner.

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-cable-robot-iteration-2-JUeS.png

Following next to eachother:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-4Cwy.jpg
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-YUUP.png
The following videos are examples of various tests we conducted to check accuracy, speed, and reliability of the robot. Various motions were tested to ensure the robot could move the payload in a variety of ways. The winch mechanism was consistent throughout testing, and the tension systems successfully kept the payload stable. Initial testing showed that consistent, accurate movements were possible, but further testing is required to determine the long-term performance at high speeds.
https://www.youtube.com/watch?v=7bPPvc_zwZ8
https://www.youtube.com/watch?v=pxpzhzksFc0
https://www.youtube.com/watch?v=3lTADzLLtf0
  ```
- **Photos / Media File Paths or URLs**:
  - `src/assets/projects/cable-robot-1.jpg`

---

## 3. Autonomous Ping-Pong Dribbling and Bouncing Robot (May 2024)
- **Title**: Autonomous Ping-Pong Dribbling and Bouncing Robot
- **Subtitle**: 2-DOF High-Bandwidth Dynamic Gimbal Platform
- **Date**: May 2024
- **Tags**: `Robotics`, `Mechatronics`, `Control Systems`, `Computer Vision`
- **Verbatim Project Text**:
  ```text
  Overview

I designed, manufactured, and prototyped a robot to dribble or bounce a ping-pong ball on a small, 6" square platform regardless of disturbances. The platform had to accelerate fast enough to bounce the ping-pong ball reliably, rotate to control the bounce trajectory, and be rigid enough to reliably predict and control the ball's movement. I worked with a team of students at UC Berkeley to integrate the design with electronics and software. My contributions included the entire mechanical design, stepper and servo motor circuitry design and implementation, and stepper motor control code.

Solution

Linear movement was controlled by stepper motors and belts actuating two linear slides. Belts allowed for faster acceleration and accuracy compared to rack and pinions and their backlash, or lead screws and their limited acceleration ability. Platform rotation was actuated with a direct driven gimbal system by two servos for fast and accurate movements.

Ball position tracking was completed with a webcam and computer vision to obtain the x, y, and z coordinates. The platform was controlled with a PID loop, taking the ball position and trajectory to change the platform position and angle to keep the ball on the platform while bouncing.

Initial Concept

Initially, we hoped to dribble the ping-pong ball on the ground while moving around a room, similar to how a basketball player would dribble around the court. This concept included a drive train with mecanum wheels for omni-directional movement and an initial gimbal and linear actuation system.

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10548/story-autonomous-pingpong-dribbling-and-bouncing-robot-cjSf.JPG

Prototyping

The initial concept was changed to a stationary frame in order to reduce project complexity and increase feasibility for the project timeline.
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10548/story-autonomous-pingpong-dribbling-and-bouncing-robot-bGhA.png

https://www.youtube.com/watch?v=bBfGa0vfWao

The singular stepper motor didn't provide sufficient torque or acceleration for our needs, so I designed another iteration using two nema-23 steppers.

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10548/story-autonomous-pingpong-dribbling-and-bouncing-robot-r6rC.png

Final Prototype

After multiple component iterations, the final prototype and control code was successfully implemented. The ping-pong ball stayed on the platform regardless of disturbances such as bounces, wind, and human interference. The longest time we ran the robot was 2 hours, in which the robot ran flawlessly, keeping the ball on the platform without any restart of the program or additional tuning.

https://www.youtube.com/watch?v=tn6nV-CjQjs


  ```
- **Photos / Media File Paths or URLs**:
  - `src/assets/projects/ping-pong-1.jpg`

---

## 4. Ocean Drone Catamaran for TAFLab (Jan 2024)
- **Title**: Ocean Drone Catamaran for TAFLab
- **Subtitle**: Autonomous Sailing Surface Vessel for Marine Data
- **Date**: Jan 2024
- **Tags**: `Marine Systems`, `Autonomous Vehicles`, `CFD`, `Composites`
- **Verbatim Project Text**:
  ```text
Overview

As a part of the Theoretical & Applied Fluid Dynamics Laboratory, I manufactured and iterated on an autonomous sailboat, to eventually be a part of a drone swarm to conduct wave prediction.
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-pxlv.png

Initial Prototype

The initial prototype was made using composite layups to create the fiberglass hulls and sails. Two rudders were controlled using a servo, and the main sail was rotated using a baby sail.

Following 2 images next to eachother
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-rgAv.jpg
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-EoyX.jpg

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-WG9n.png

Iteration

The initial prototype had issues with controlled rotation of the mainsail and straight-line, point-to-point sailing.

To address this issue, I prototyped and implemented the actuation of the rudders and baby sail for a solid initial functioning prototype and water test. However, early testing revealed that high friction in the mast bearings prevented smooth actuation and control of the mainsail.

I redesigned the bearing housings to increase the spacing and stability of the mast. This successfully reduced friction enough to enable the smaller baby sail to rotate the mainsail into more optimal sailing orientations. Further testing and iteration led to improvements including rotation constraints and detent mechanisms for additional control.

Through component integration, prototyping, test stand experiments, and on-water trials, I was able to demonstrate reliable control over sailing direction by actuating the main sail with the baby sail system. These upgrades provide a more controllable foundation to facilitate future sensing, automation algorithms, and performance advancements toward an autonomous robotic sailing platform.

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-f4mc.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-ii5C.png
https://www.youtube.com/watch?v=s7Ifoe6i6nc
  ```

---

## 5. High-Speed Cable Robot to Catch Drones (Dec 2023)
- **Title**: High-Speed Cable Robot to Catch Drones
- **Subtitle**: 3000 RPM Dynamic Recovery Winch System
- **Date**: Dec 2023
- **Tags**: `High Speed`, `Winch Mechanics`, `Drone Recovery`, `Mechanical Design`
- **Verbatim Project Text**:
  ```text
Overview

Our team was tasked with designing and prototyping a planar cable robot capable of catching mid-flight automated drones landing at 20 mph. I designed the winch system, which needed to be robust, running at up to 3000 rpm, and spool uniformly and consistently while smoothly interfacing with the pulley system.

Solution

I designed, machined, and assembled a frame and motor pods that allowed for easy spooling and unspooling of cable. I designed a winch that spooled wire into grooves in a single layer around the drum. To prevent tangling, a pulley translates and guides the wire along with the spooling or unspooling rotation.

Concept Generation

Following images next to eachother
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-KKPj.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-7n3u.png

CAD
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-Qi0S.JPG

Prototypes
First two next to eachother:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-tP6Z.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-XeDs.jpg
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-Ffyw.jpg

https://www.youtube.com/watch?v=H41Bj0lks0U
https://www.youtube.com/watch?v=nL89zjuW9EQ
  ```

---

## 6. Construction Robot Stability Outrigger Simulation (Aug 2023)
- **Title**: Construction Robot Stability Outrigger Simulation
- **Subtitle**: FEA and Dynamic Simulation for 1500 lb Robotic Platform
- **Date**: Aug 2023
- **Tags**: `FEA Simulation`, `Structural Analysis`, `Hydraulics`, `Heavy Machinery`
- **Verbatim Project Text**:
  ```text
  Overview

Raise Robotics was switching to a new tracked mobile base from the previous mecanum wheel mobile base. I was tasked with integrating the new mobile base into the existing robot assemblies and preparing the model for URDF simulation and real-world assembly and deployment. I quickly noticed a design flaw where the robot would easily tip over. I then collaborated with other engineers to develop a stability outrigger system with actuated legs. Overall, I greatly increased simulation accuracy and stability of the robot.

Tracked Mobile Base

I didn't have access to a 3D model of the tracked base at first, so I manually converted an AutoCAD file into an Inventor model, extrapolating dimensions when necessary. Later I received more detailed drawings and parts, and these were integrated into the model.

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8934/story-stability-outrigger-system-simulation-and-development-vqt9.jpg
Next to next to eachother:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8934/story-stability-outrigger-system-simulation-and-development-utyr.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8934/story-stability-outrigger-system-simulation-and-development-uCd0.png

URDF Preparation

I removed the previous mobile base and replaced it with the new tracked base model I created. Next, I addressed issues with the assembly in order to increase model accuracy.

Model Mates: Many constraints were broken or didn't exist due to past exports into different software versions. I carefully reviewed all of the model mates in each assembly and made adjustments where necessary to ensure that they were accurate and properly aligned.

Geometries: I reviewed all of the geometries in each subassembly and made adjustments where necessary to ensure that they matched the real-world dimensions of each part. Multiple parts were outdated, which I replaced with newer assemblies, fixing mates when necessary.

Mass/Material Assignments: Finally, I reviewed all of the mass/material assignments of each subassembly and made adjustments where necessary to ensure that they accurately reflected reality.

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8934/story-construction-robot-stability-outrigger-simulation-qhd2.png

Stability Simulation

Assigning materials and weights to every subassembly meant that the center of gravity was not much more accurate. I noticed that due to the track geometry and location of the center of gravity, the robot would likely be prone to tipping. Thus, I decided to run multiple dynamic simulations in order to determine how to prevent tipping. I simulated assuming the arms were rotating at max torque and an approximate friction coefficient.

I repeated the simulation with multiple counterweights, but due to the robot's already high mass, any effective counterweight would greatly impact the max load of the mobile base, and would not increase stability significantly. I repeated the simulations with accurate suspension damping, and the results were the same.

https://www.youtube.com/watch?v=gG62t-yrwMA
https://www.youtube.com/watch?v=gG62t-yrwMA

Outrigger Development

I collaborated with other engineers to design a stability outrigger system with actuated legs. I conducted FEA and further dynamic simulations to determine the optimal geometry and attachment structure. I also researched various actuation methods such as pneumatics and electric linear actuators, optimizing for system complexity, energy efficiency, precision, strength, and speed.
  ```

---

## 7. Modular Bracket Gripper (Aug 2023)
- **Title**: Modular Bracket Gripper
- **Subtitle**: Pneumatic End-Effector for Automated Steel Assembly
- **Date**: Aug 2023
- **Tags**: `Mechatronics`, `Automation`, `CNC Machining`, `Robotic Grippers`
- **Verbatim Project Text**:
  ```text
Overview

Large J Brackets are used to install curtain wall facades on the edge of buildings. Typically, this requires a human to install these metal brackets hanging off the side for each bracket. Raise Robotics is developing a robot to complete these dangerous and repetitive tasks. Thus, a solution is needed to hold onto these brackets so they can be fastened to the side of the building.

My task was to design a gripper that can be used to grab and place the J bracket from the bracket’s loading position into its placement position.

Following images next to eachtoherA:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-fztA.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-JDAk.png

Solution

I designed a modular gripper intended for easy prototyping and iteration. It is made from 4 aluminum plates that can be waterjet or plasma cut with minimal material waste, and adhered or welded together. I also designed the gripper to have a modular gripping surface. I created a rubber gripping surface that can be screwed onto the gripper brackets as shown in the assembly drawings. A different part made of different materials or different surface textures can easily be designed with holes in the correct places to replace this rubber pad.

Folloiwng 2 next to eachother
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-tX09.JPG
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-5iCR.JPG

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-xmnr.jpg
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-tKay.jpg
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-avkm.jpg
  ```

---

## 8. Autonomous Underwater Robot (May 2023)
- **Title**: Autonomous Underwater Robot
- **Subtitle**: Sub-Surface Torpedo Launcher, Dropper, and Gripper
- **Date**: May 2023
- **Tags**: `Marine Robotics`, `Pressure Vessels`, `Pneumatics`, `Waterproofing`
- **Verbatim Project Text**:
  ```text
  RoboSub Challenge

The 2022-2023 RoboSub challenge required a torpedo launcher, weight dropper, and object gripper in order to complete the autonomous underwater tasks.

next to eachother:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-underwater-torpedo-launcher-fhlL.JPG
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-HUXm.JPG

Torpedo Launcher

I developed an underwater torpedo launcher that is accurate within 5 inches at 4 feet distance. I designed the torpedo launcher to use one servo to launch two torpedoes. If the servo rotates in one direction, it releases one torpedo which is launched using a compressed spring. If the servo rotates in the opposite direction, the second torpedo will be launched.

When designing the spring mechanism I conducted extensive calculations to ensure that the torpedoes would travel four feet at a reasonably high speed and accuracy. I used a damped mass-spring system to simulate the spring and torpedo with drag from the water. Using the release velocity from the spring, I calculated the trajectory of the torpedo underwater using a simplified torpedo geometry to approximate the drag coefficient. This allowed an informed decision of the ideal spring rate, max. load, and length.

next eachother:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-1pCg.JPG
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-sNV5.JPG

Dropper Mechanism

I designed a dropper mechanism that can drop two weights accurately from a two foot distance into a container. Rotating the servo in one direction would drop a weight, and rotating it in the opposite direction would drop the second weight.

next eachother:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-fRJF.JPG
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-kgOz.JPG

Rack and Pinion Gripper

The AUV had to grab a large, flat sided object from a flat surface. I designed a rack and pinion gripper in order to pick up these objects. Running the motor would rotate the gear, moving one gripper wall closer to the other, until it gripped the object.

next eachother:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-cb8b.JPG
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-79bz.JPG

Waterproofing

We used servos waterproof rated for splashes and short underwater periods, so further waterproofing was required. I researched and waterproofed each servo using mineral oil, O-rings, epoxy, and lubricant.
  ```

---

## 9. Anti-Tangle Winch for Drone Fleet (May 2023)
- **Title**: Anti-Tangle Winch for Drone Fleet
- **Subtitle**: Diamond-Screw Reciprocating Level-Wind Mechanism
- **Date**: May 2023
- **Tags**: `Mechanism Design`, `Level-Wind`, `Winch Systems`, `Reliability Engineering`
- **Verbatim Project Text**:
  ```text
  Overview

Sentien, a drone fleet company, faced issues with their winch system due to bird nesting and tangling. These problems caused delays in operations and decreased the reliability of their drones. They needed a low-cost solution that was durable against the force applied from loading and solved these issues.

I took on the challenge of developing and manufacturing an anti-tangle winch for Sentien's drone fleet using SolidWorks, 3D printed prototypes, and FEA to improve function and reliability.

Solution

I began by analyzing the current winch system used by Sentien's drones. We identified bird nesting as the primary issue causing tangling. To solve this problem, I designed a new winch system that increased uniform winding distribution using a reciprocating screw mechanism.

After several rounds of testing and modifications, I was able to develop an anti-tangle winch that increased reliability by over 2x compared to the previous system. Our solution was also lightweight, durable against loading force, and cost-effective for Sentien's needs.

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8936/story-developing-antitangle-winch-for-drone-fleet-k1rl.JPG

Previous Winch Problem
https://www.youtube.com/watch?v=kzrlA5E0D6w

Concept Generation
Next to eachother:
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8936/story-developing-antitangle-winch-for-drone-fleet-Idz5.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8936/story-developing-antitangle-winch-for-drone-fleet-Uh9U.png

Initial Prototypes

https://www.youtube-nocookie.com/channel/UCJEJhN_qIwqNa338LrNbzUA
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8936/story-developing-antitangle-winch-for-drone-fleet-t70a.png

Impact

Increased reliability compared to previous system

Reduced delays in operations due to tangling issues

  ```

---

## 10. Scrubtious: Convenient, Reusable, Bottle Scrubber (Dec 2022)
- **Title**: Scrubtious: Convenient, Reusable, Bottle Scrubber
- **Subtitle**: Consumer Product Design and Injection Molding DFM
- **Date**: Dec 2022
- **Tags**: `Product Design`, `DFM`, `Injection Molding`, `Sustainability`
- **Verbatim Project Text**:
  ```text
  Overview

Many bottle brushes on the market fail to guarantee a complete clean, are hard to control, and are made for specific bottles or cups. This often means that people need multiple brushes for multiple bottles, and the bulkiness of these brushes can allow users to miss spots on the wall of larger cups or bottles. Additionally, many of these brushes have irreplaceable brushes or sponges, making them environmentally unfriendly.

The Solution

To solve this problem, we created Scrubtious to attach to any standard Scrub Daddy or Scrub Mommy and makes it easier to clean all the walls of the bottle. The brush spins as it's pushed down to make sure it gets every section of the inside, including the bottom. The spring in between the handle and the cap makes sure it pops back up when released. It can be used on multiple different sized bottles since the cap is tapered to fit tops with different diameters ranging from 2 to 4 inches. It uses a sponge that already exists and is at many popular stores so it can be easily replaced or taken off the holder to be used to clean other dishes and surfaces. It can accommodate both small and large bottles and the removable sponge attachment saves money and reduces plastic waste. Simply place the mechanism on the bottle and push down, and any bottle can be cleaned.

https://showspace.so/_next/image?url=https%3A%2F%2Fchmqmeyyaiwfybqgcdoy.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fprojects%2F10276%2Fthumbnail-scrubtious-eco-friendly-versatile-bottle-brush-Eh.jpg&w=1920&q=50

Following in carosoul

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-41e0.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-pOKf.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-Bf5B.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-ohTg.png
https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-9oCy.png


  ```

  ---

## 11. First Tech Challenge Robotics (may 2021)
- **Title**: First Tech Challenge Robotics
- **Subtitle**: Robotics Team Mech Lead + Captain
- **Date**: may 2021
- **Tags**: `
- **Verbatim Project Text**:

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8941/story-first-tech-challenge-robotics-MIPL.png
https://www.youtube.com/watch?v=9Ddy6e1VPDw

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8941/story-first-tech-challenge-robotics-TrGT.png
https://www.youtube.com/watch?v=IlprMu46Uzo

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8941/story-first-tech-challenge-robotics-B0yZ.png
https://www.youtube.com/watch?v=j09PzmVmzJw

https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8941/story-first-tech-challenge-robotics-K2lX.png
https://www.youtube.com/watch?v=UxK5wK2jlCU


