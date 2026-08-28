import { Project } from '../types/project';

export const projectsData: Project[] = [
  // 1. Tesla Deployable Linear Actuation Mechanism (September 2024 – January 2025)
  {
    id: 'tesla-linear-actuator',
    title: 'Tesla Deployable Linear Actuator',
    subtitle: 'Dual Synchronized Lead Screws & Telescoping Mechanism',
    date: 'September 2024 – January 2025',
    dateRange: 'September 2024 – January 2025',
    year: 2025,
    company: 'Tesla',
    companyLogo: '/tesla-logo.png',
    companyUrl: 'https://www.tesla.com',
    tags: ['Mechanism Design', 'Telescoping Kinematics', 'FEA Analysis', 'Belt Transmission', 'GD&T Drawings'],
    modelType: 'tesla-actuator',
    description: 'Designed, engineered, and validated a proof-of-concept deployable linear actuation mechanism with synchronized dual lead-screws, custom belt transmission, and active anti-pinch current sensing for Tesla. Developed theoretical hand calculations, static FEA, machining workflows, and engineering drawing packages for team replication.',
    extendedDescription: [
      'Led the mechanical design, analytical validation, prototyping, and testing of a compact linear deployment mechanism for Tesla. The mechanism deploys a critical component between strict spatial envelopes while satisfying rigorous deflection, cycle life, and safety constraints.'
    ],
    structuredSections: [
      {
        heading: 'Project Overview & Requirements',
        paragraphs: [
          'The objective was to engineer a proof-of-concept linear actuation mechanism capable of deploying an internal payload between predefined spatial positions and orientations while adhering to tight volume constraints, deployment velocity requirements, deflection limits under external loads, and anti-pinch safety standards.',
          'Key constraints included: (1) Packaging inside a restricted envelope, (2) Strict deflection and freeplay thresholds under maximum deployment load, (3) Safe anti-pinch current-sensing shutoff, (4) Repeatable cycle life with minimal maintenance, and (5) Design for manufacturing and production scalability.'
        ]
      },
      {
        heading: 'Architecture Tradeoffs: Telescoping Columns vs Linear Slides',
        paragraphs: [
          'Extensive trade studies were conducted across multiple linear motion architectures including drawer slides, linear profile guide rails, telescoping columns, rack and pinion drives, cable winches, and four-bar linkages. Rapid cardboard and 3D printed mockup iterations were evaluated inside physical space mockups.',
          'Linear guide rails provided high stiffness but carried severe packaging drawbacks, high cost, and required frequent lubrication prone to debris contamination. Telescoping rectangular aluminum tubes with custom-machined Delrin corner sliders were selected: 2-stage overlap minimized cantilever deflection and freeplay, while Delrin sliders delivered an exceptionally low friction coefficient against aluminum with zero external lubrication requirements.'
        ]
      },
      {
        heading: 'Theoretical Analysis & Sizing Calculations',
        subSections: [
          {
            title: 'Lead Screw Buckling & Critical Whirling Speed',
            content: 'Calculated critical Euler buckling loads (P_cr) and critical rotation speeds (omega_cr) for dual 1018 steel lead screws under peak axial loading with fixed-fixed thrust and radial bearing supports to prevent catastrophic harmonic whipping.'
          },
          {
            title: 'Hertzian Contact Stress & Slider Strain',
            content: 'Evaluated cylindrical-against-flat contact stresses on the Delrin slider corner pads. Verified that maximum shear stresses (27 MPa) remained well within the elastic regime, keeping material strain below 3% to eliminate permanent slider deformation across cycles.'
          },
          {
            title: 'Synchronous Transmission Sizing',
            content: 'Sized a high-torque NEMA motor and custom timing belt reduction. Machined custom D-profiles directly onto the lead screw ends to interface directly with flanged timing pulleys, eliminating heavy keyways and fitting within ultra-tight packaging clearances.'
          },
          {
            title: 'Static FEA Structural Verification',
            content: 'Conducted static Finite Element Analysis (FEA) on critical sheet metal mounting brackets and tube interface plates under maximum applied loads to confirm adequate safety factors prior to manufacturing.'
          }
        ]
      },
      {
        heading: 'Manufacturing & Prototyping',
        subSections: [
          {
            title: 'Precision Machining',
            content: 'Faced and slotted aluminum tubes on CNC/manual milling machines using common datum references for slider alignment. Turned custom retaining grooves and D-profiles on precision lead screws using a lathe.'
          },
          {
            title: 'Sheet Metal Fabrication',
            content: 'Waterjet-cut mounting plates from structural aluminum. Calibrated press-brake bend radii experimentally to achieve exact angular tolerances for motor and tube cradle brackets.'
          },
          {
            title: 'Tolerancing & Clearances',
            content: 'Iteratively tuned running clearances between telescoping tubes using calibrated Teflon shims and 3D printed verification parts to achieve the optimal balance between low friction and zero freeplay.'
          }
        ]
      },
      {
        heading: 'Electronics & Anti-Pinch Control',
        paragraphs: [
          'Developed an ESP32 microcontroller system paired with a high-power H-bridge motor driver and an INA precision current shunt sensor. The firmware monitors real-time motor current draw against expected trajectory profiles, immediately halting motor actuation if an obstruction is detected (anti-pinch safety threshold) or when hard stops are reached.'
        ]
      },
      {
        heading: 'Results & Deliverables',
        paragraphs: [
          'The proof-of-concept prototype successfully verified all functional requirements: compact packaging envelope, smooth deployment velocity, minimal cantilever deflection, and robust anti-pinch current cutoff.',
          'Delivered a comprehensive GD&T engineering drawing package—including part tolerances, subassembly breakdowns, and bill of materials (BOM)—providing the Tesla engineering team with the foundation for subsequent production iterations.'
        ]
      }
    ],
    specs: [
      { label: 'Kinematic Stroke', value: '350 mm Dual-Stage Extension' },
      { label: 'Drive Architecture', value: 'Synchronized Dual 1018 Steel Lead Screws' },
      { label: 'Transmission', value: 'High-Torque Belt Reduction with Custom D-Pulleys' },
      { label: 'Linear Guide', value: 'Telescoping 6061-T6 Aluminum with Delrin Sliders' },
      { label: 'Anti-Pinch Safety', value: 'Real-time INA Current Shunt Sensing Cutoff' },
      { label: 'Max Deflection', value: '< 1.5 mm under peak cantilever payload' }
    ],
    materialsAndManufacturing: [
      '6061-T6 Aluminum rectangular tubing faced and precision-machined on CNC/manual mill',
      'Turned 1018 steel lead screws with machined retaining ring grooves and D-profiles',
      'Waterjet-cut and press-brake formed aluminum sheet metal motor and tube mounting plates',
      'Custom Delrin (POM) low-friction machined slider corner pads (< 3% elastic strain)',
      'Rapid prototype validation with calibrated Teflon shim clearances and additive components'
    ],
    keyChallenges: [
      'Eliminated cantilever deflection and freeplay without resorting to heavy, debris-vulnerable linear profile rails by optimizing a 2-stage telescoping overlap.',
      'Achieved strict packaging constraints by machining custom D-profiles directly onto lead screw shafts to eliminate heavy shaft collars.',
      'Implemented real-time active anti-pinch firmware monitoring current spikes to safely stop motor actuation upon human or obstacle contact.'
    ],
    palette: {
      primary: '#e82127',
      secondary: '#94a3b8',
      accent: '#3b82f6',
      base: '#0f172a',
      details: '#cbd5e1'
    }
  },

  // 2. Inductive IR3 Autonomous EV Charging Robot (Jun 2024 – Sep 2024)
  {
    id: 'inductive-autonomous-charging-robot',
    title: 'Inductive IR3 Autonomous EV Charging Robot',
    subtitle: 'Mobile Robotic EV Fast-Charging UGV System',
    date: 'Jun 2024 – Sep 2024',
    dateRange: 'Jun 2024 – Sep 2024',
    year: 2024,
    company: 'Inductive Robotics',
    companyLogo: 'https://www.inductiverobotics.com/images/logo/logo.svg',
    companyUrl: 'https://www.inductiverobotics.com',
    tags: ['Mobile Robotics', 'Clearpath Husky UGV', 'Chassis Modification', 'Battery Subframe', 'Robotic Arm Integration'],
    modelType: 'inductive-robot',
    description: 'Engineered mechanical subsystems, structural chassis modifications, high-voltage battery payload mounting, and welded robotic arm integration for the first-generation Inductive IR3 autonomous mobile EV charging robot built on a Clearpath Husky UGV platform.',
    extendedDescription: [
      'Designed, prototyped, and tested mechanical integration systems for an autonomous mobile robot capable of navigating parking facilities, docking with electric vehicles, delivering fast-charging power from an onboard battery payload, and returning to base.'
    ],
    structuredSections: [
      {
        heading: 'Project Background & Problem Statement',
        paragraphs: [
          'Traditional parking lot charging infrastructure is bottlenecked by stationary chargers: once a vehicle finishes charging, the stall remains occupied for the remainder of the workday, leaving other EVs uncharged.',
          'Inductive Robotics conceived an autonomous mobile robotic solution that carries high-capacity EV fast-charging batteries and an articulated robotic arm. The robot autonomously navigates parking structures, charges parked vehicles to target levels, disengages, and moves to the next car, maximizing charging throughput per stall.'
        ]
      },
      {
        heading: 'Engineering Requirements & Constraints',
        paragraphs: [
          'The system integrated a modified Clearpath Husky Unmanned Ground Vehicle (UGV) chassis to support the heavy charging payload consisting of: (1) High-capacity EV battery pack, (2) DC fast charger / inverter, (3) Articulated robotic charging arm, (4) Onboard compute and autonomy hardware, and (5) Navigation LiDAR and sensor suite.',
          'Core mechanical requirements: (1) Payload weight constrained below the Husky chassis 160 lb maximum load rating, (2) Secure structural mounting under dynamic vehicle acceleration/braking, (3) Modular architecture for rapid field maintenance, and (4) High-voltage wiring isolation meeting industrial safety standards.'
        ]
      },
      {
        heading: 'Mechanical Design & Subsystems',
        subSections: [
          {
            title: 'Chassis Remodeling & Physical Verification',
            content: 'Identified critical discrepancies between supplier CAD models and physical hardware dimensions. Conducted extensive physical coordinate measurement and 3D modeling of the Clearpath Husky chassis to guarantee zero-interference component packaging.'
          },
          {
            title: 'Modular Battery Payload Subframe',
            content: 'Engineered an aluminum extrusion subframe providing X/Y adjustability for future battery pack upgrades. Secured the battery pack vertically using high-strength steel tie-down rods with vibration-damping elastomer pads to protect battery cells from road shock.'
          },
          {
            title: 'Welded Robot Arm Pedestal Structure',
            content: 'Designed a high-rigidity welded steel pedestal and mounting spacer to elevate and securely anchor the articulated robotic charging arm to the chassis, balancing torsional stiffness against weight limits.'
          },
          {
            title: 'Mass Distribution & Center of Gravity',
            content: 'Modeled center of gravity (CoG) and moment of inertia across charging arm workspace configurations to ensure dynamic vehicle rollover stability during aggressive maneuvering.'
          }
        ]
      },
      {
        heading: 'Fabrication & Manufacturing Drawings',
        paragraphs: [
          'Produced formal manufacturing drawing packages including welded arm pedestal weldments, chassis cutting templates, CNC machined spacers, and sheet metal brackets with standard GD&T tolerances.',
          'Successfully manufactured and assembled the IR3 prototype, demonstrating robust payload stability and mechanical integration during field mobility and charging validation trials.'
        ],
        imagesLayout: 'grid-2-1',
        images: [
          {
            type: 'image',
            url: './Inductive Robotics Render No Background.png',
            title: 'Inductive IR3 Full Autonomous EV Charging Robot CAD Assembly',
            caption: 'Clearpath Husky UGV chassis with integrated battery subframe, welded pedestal, and articulated charging arm'
          }
        ]
      }
    ],
    specs: [
      { label: 'Base Platform', value: 'Clearpath Husky 4WD UGV Chassis' },
      { label: 'Payload Capacity', value: '160 lb (72.5 kg) Rated Maximum' },
      { label: 'Battery Subframe', value: 'Modular 6061-T6 Aluminum Extrusion with Elastomer Mounts' },
      { label: 'Charging Arm', value: 'Multi-DOF Articulated Arm on Welded Steel Pedestal' },
      { label: 'Autonomy Sensor Suite', value: '3D LiDAR Mast, RGB-D Depth Cameras, Onboard Compute' },
      { label: 'Application', value: 'Autonomous Multi-Vehicle EV Parking Lot Fast Charging' }
    ],
    materialsAndManufacturing: [
      'Clearpath Husky UGV structural frame precision cutting and reinforcement modifications',
      'Welded heavy-duty steel tube arm pedestal spacer with FEA stress analysis validation',
      '6061-T6 modular aluminum extrusion battery enclosure with threaded steel hold-down clamp bars',
      'Vibration-damping elastomer isolation pads between battery pack and chassis to absorb road shocks',
      'CNC milled high-voltage electrical mounting plates and waterjet cut component brackets'
    ],
    keyChallenges: [
      'Overcame severe dimensional errors in manufacturer CAD models by performing full manual physical measurement and 3D coordinate scanning of the Husky chassis.',
      'Balanced heavy 160 lb payload mass distribution and center of gravity to ensure dynamic vehicle stability and rollover prevention across arm workspace trajectories.',
      'Designed modular, quick-disconnect battery subframe mounting enabling rapid servicing and future high-capacity cell upgrades.'
    ],
    palette: {
      primary: '#f59e0b',
      secondary: '#1e293b',
      accent: '#0284c7',
      base: '#0f172a',
      details: '#94a3b8'
    }
  },

  // 3. Robot Humanoid Hand Mirroring (Aug 2024 - Dec 2024)
  {
    id: 'robot-hand-mirroring',
    title: 'Robot Humanoid Hand Mirroring',
    subtitle: 'Sawyer Arm & 5-DOF Articulated End-Effector',
    date: 'Aug 2024 – Dec 2024',
    dateRange: 'Aug 2024 – Dec 2024',
    year: 2024,
    company: 'UC Berkeley',
    companyLogo: '/berkeley-logo.png',
    companyUrl: 'https://www.berkeley.edu',
    tags: ['Robotics', 'Kinematics', 'Computer Vision', 'Tendon Drive', 'ROS2'],
    description: 'My team designed a robotic system which implements visual tracking to mirror a user’s hand and finger movements on a Sawyer arm and custom humanoid hand end effector. I designed the custom robotic hand to be integrated with a robotic arm and custom electronics, assisted with PCB design and assembly, as well as code integration.',
    projectWebsiteUrl: 'https://sites.google.com/berkeley.edu/handymanny/introduction?authuser=0',
    extendedDescription: [
      'My team designed a robotic system which implements visual tracking to mirror a user’s hand and finger movements on a Sawyer arm and custom humanoid hand end effector. I designed the custom robotic hand to be integrated with a robotic arm and custom electronics, assisted with PCB design and assembly, as well as code integration.'
    ],
    structuredSections: [
      {
        heading: 'Background',
        paragraphs: [
          'Humanoid robotics is a growing field of research and startups which leverage the adaptability of the human body for a wide variety of applications. Given the large corpus of data concerning human activities (videos, images, live sensing, etc.), robots can solve human-level tasks faster through imitation of humans.',
          'However, there’s a hole in the data concerning the force applied by human actions (Eg: how much force is needed to push a button? What is the compensation by the arm when using a certain tool?). Our goal is to augment the existing tools to map human motion with a measurement device for applied force to an object in the grasp of a human-like hand for use in pose estimation (and eventually extend to imitation learning more broadly).'
        ]
      },
      {
        heading: 'Goals',
        paragraphs: [
          'Our initial ambitious goal was to create a glove worn by a human user with strain gauges and pressure sensors on the fingertips. The hand movements in space, finger movements, and forces would then be replicated on a custom robotic hand on a Sawyer robot. The force sensing goal was removed from the scope of the project due to integration time constraints. The force sensing electronics and software worked, but integration onto the custom hand was not feasible in our timeline.'
        ]
      },
      {
        heading: 'Mechanical Design',
        subSections: [
          {
            title: 'Hand Base and Palm',
            content: 'The main structure of the hand is manufactured using 3D-printed PLA. Holes route tension lines through the hand and to the phalanxes. All critical hardware and electronics for the hand, including the PCB and servos are mounted to this part using bolts and spacers. This part is designed to be structurally strong and mount securely to the Sawyer. The hand must be able to hold up to repeated testing without requiring extensive remanufacturing and reassembly. The fingers are mounted to secure slots next to angled faces to facilitate proper bending angle of each finger. Holes in the back line up with the PCB holes for servo wire routing.'
          },
          {
            title: 'Phalanxes and Tension Lines',
            content: 'Each finger is made up of 3 different sized phalanxes with tension line routing holes. Similar to the hand base, each phalanx has 2 mounting slots for joints and angled faces for the ideal bending angle of each phalanx. When the tension lines are correctly routed through the phalanxes, shortening the length of the tension line through the phalanxes causes a motion similar to that of a human finger in flexion. The tension lines are securely tied to the final phalanx of each finger to keep tension.'
          },
          {
            title: 'Finger Joints',
            content: 'Made of TPU (85A Shore Hardness) for the optimal balance of flexibility and elasticity and finger flexion behavior. Geometry clearances to securely fit inside of phalanx slots without any slipping.'
          },
          {
            title: 'Micro Servos',
            content: 'Five SG90 micro servos actuate the fingers using the tension line system. The tension lines are secured to the end of servo horns mounted to each micro servo output. 9G servo motors are used to meet the torque requirement for basic hand movements while being small enough to fit inside of the hand palm.'
          }
        ],
        imagesLayout: 'grid-2-1',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/11556/story-robot-humanoid-hand-mirroring-G6Y5.png',
            title: 'Hand Base and Palm Structure',
            caption: '3D-printed structural PLA Hand Base and Palm assembly with servo mounting cavity'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/11556/story-robot-humanoid-hand-mirroring-j1Ij.png',
            title: 'Phalanxes and Internal Cable Routing',
            caption: 'Articulated phalanx segments showing internal Dyneema tension cable routing channels'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/11556/story-robot-humanoid-hand-mirroring-3g5c.png',
            title: 'TPU Compliant Finger Joints',
            caption: 'Flexible 85A TPU elastomer joints engineered for smooth, natural finger flexion'
          }
        ]
      },
      {
        heading: 'Custom PCB',
        paragraphs: [
          'Mounted on the back of the hand for servo power distribution, sensing, microcontroller, and communication. Regulates 12V power input to 5V, 1.5A output to the servos.',
          'Unfortunately, due to a small mistake in the circuit design, the microcontroller was unusable, so the circuit ended up only being used for power regulation. Sensing worked, but time limitations unfortunately meant it wasn\'t implemented in time. The PCB is mounted to the hand using bolts and spacers to ensure secure, stable mounting and leaving room for solder and wires underneath the board.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/11556/story-robot-humanoid-hand-mirroring-weNx.JPG',
            title: 'Custom Power Regulation PCB',
            caption: 'Custom 2-layer PCB mounted on the back of the hand regulating 12V to 5V, 1.5A for the servo array'
          }
        ]
      },
      {
        heading: 'Design Limitations',
        paragraphs: [
          'While simplifications made to the hand reduces complexity and increases reliability, it prevents a fully accurate representation of a human hand\'s range of motion. This limits the robotic hand’s applicability in tasks requiring nuanced thumb movements or fine motor skills, such as pinching or precision grips.',
          'Although the hand can perform basic tasks, such as gripping a solo cup, it struggles with more intricate or variable object shapes and sizes. In real-world engineering applications, this would limit its utility in environments requiring fine manipulation.'
        ]
      },
      {
        heading: 'Results & Video Demos',
        paragraphs: [
          'The mechanical hand worked well, successfully actuating each finger to their desired flexion. The robot can consistently follow the user\'s hand position and mimic its rotation while estimating the user\'s joint angles.'
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=9tvFBUCePyw',
            title: 'Robotic Hand Mirroring Teleoperation Demo'
          },
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=dH4k_KfnNgs',
            title: 'Sawyer Arm Dynamic Pose & Grasping Test'
          }
        ]
      },
      {
        heading: 'Conclusion & Discussion',
        paragraphs: [
          'The robotic hand successfully performed basic gripping tasks, such as holding a solo cup or objects with similar large diameters. However, the limited servo torque and DOF in the current robotic hand meant that gripping smaller and heavier objects was impossible.',
          'The robot effectively mirrors user\'s movements onto the 3D plane, but there\'s also latency in movement to new positions. On occasions, with an outwardly simple movement to a new position, the Inverse Kinematics solution would lead the Sawyer Arm to rotate its linkages and take its time to reach the new position.'
        ]
      },
      {
        heading: 'Future Improvements',
        paragraphs: [
          'The next stage of the project is to integrate a single camera system capable of both hand orientation and location. We plan to also implement depth detection for mirroring movements in a 3D space, instead of a 2D plane. To accomplish that, however, we\'d need to use a different camera, possibly with depth but with better resolution.',
          'We also aim to integrate pressure sensors and strain gauges into the robotic hand\'s fingers to improve robotic force control, gather gripping data applicable to research and accurately imitate the user\'s force in grabbing objects. This addition will allow the robotic hand to adjust its gripping force, allowing for effective manipulation of fragile objects (such as an egg).',
          'We would like to optimize the Inverse Kinematics solver and improve the camera, so that the lag between detecting movement and moving the arm can be fixed while possibly fixing the issue of certain poses taking extremely long routes to reach.',
          'Finally, increasing the degrees of freedom in the fingers and thumb can improve future robotic hands. By adding additional actuation points and types of joints, the robotic hand can achieve more human motion. The improved dexterity can mean improvements to handling and gripping tasks.'
        ]
      },
      {
        heading: 'Final Thoughts',
        paragraphs: [
          'If given further time and resources, the project could become a highly functional robotic hand applicable in assistive technologies, research, or manufacturing. The project was originally inspired by Kind Humanoid Robotics, for precision applications of mimicking and robotic hand movements and grasp functionalities. Combining the hardware and software upgrades would significantly improve its precision, adaptability, and real-world applications.'
        ]
      }
    ],
    specs: [
      { label: 'Degrees of Freedom', value: '5 DOF Hand + 7 DOF Sawyer Arm' },
      { label: 'Actuation', value: '5x SG90 Micro-Servos (Tendon System)' },
      { label: 'Joint Material', value: 'TPU (85A Shore Hardness)' },
      { label: 'Structure Material', value: '3D-Printed Structural PLA' },
      { label: 'Power Regulation', value: 'Custom PCB (12V in -> 5V, 1.5A out)' },
      { label: 'Control & Tracking', value: 'ROS2 / OpenCV Hand Pose Estimation' }
    ],
    materialsAndManufacturing: [
      '3D-Printed PLA Palm and Phalanx Linkages',
      'Flexible TPU (85A Shore Hardness) Compliant Flexion Joints',
      'High-Strength Monofilament Tendon Lines',
      'SG90 9g Micro Servos with Custom Actuation Horns',
      'Custom 2-Layer Power Distribution & Voltage Regulation PCB'
    ],
    keyChallenges: [
      'Optimizing TPU joint geometry and phalanx clearances to ensure pure flexion motion without rotational twisting.',
      'Mitigating Sawyer Inverse Kinematics path planning latency during rapid teleoperated motion changes.'
    ],
    modelType: 'robot-hand',
    palette: {
      primary: '#d6d1c8',
      secondary: '#8a94a0',
      accent: '#e64d3d',
      base: '#2e4438',
      details: '#1e252b'
    }
  },

  // 2. High Speed Cable Robot Iteration 2 (Jan 2024 - May 2024)
  {
    id: 'cable-robot-iteration-2',
    title: 'High Speed Cable Robot Iteration 2',
    subtitle: 'Planar Parallel Cable-Driven Robot',
    date: 'Jan 2024 – May 2024',
    dateRange: 'Jan 2024 – May 2024',
    year: 2024,
    company: 'Sentien Robotics',
    companyLogo: 'https://media.licdn.com/dms/image/v2/D560BAQG-jDLP_8B52g/company-logo_200_200/company-logo_200_200/0/1728988379666/sentien_robotics_logo?e=1788998400&v=beta&t=bbhNRf0apD7CQa7Bgrr4AxpBwAPcelxmJsSM7K7XP4w',
    companyUrl: 'https://www.sentienrobotics.com',
    tags: ['Parallel Robotics', 'High Speed', 'Controls', 'Tension Dynamics'],
    description: 'Led development of further iterations and testing of cable robot, improving reliability and robustness in high speed and accurate movements.',
    extendedDescription: [
      'Led the development of further iterations and testing of an 8\'x8\' high speed cable robot for Sentien Robotics to accurately catch landing drones at high speeds.'
    ],
    structuredSections: [
      {
        heading: 'Overview',
        paragraphs: [
          'I led the development of further iterations and testing of an 8\'x8\' high speed cable robot. The goal was to improve reliability and robustness in high speed and accurate movements, while increasing the size of the robot to the size of a shipping container. I led the team through every stage of the design process, keeping timelines, assigning tasks and reviewing designs to ensure quality and on-time deliverables. I also designed, manufactured, and assembled multiple components and mechanisms including winch plates and frame brackets.',
          'Sentien’s current automated drone storage method requires a lengthy manipulation process after the drone lands, and isn’t capable of handling fixed wing drones. Sentien’s suggested solution is a 2D cable robot the size of a shipping container that can accurately catch landing drones at high speeds.'
        ]
      },
      {
        heading: 'Solution',
        paragraphs: [
          'Multiple mechanisms were simplified for increased reliability and reduced assembly difficulty. The robot frame was strengthened to hold up to high acceleration required to match the speed of landing fixed wing drones. Tensioners were designed to give some leeway in software control and prevent cable slack.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-NVBD.png',
            title: 'Winch & Gantry Frame CAD',
            caption: 'High-speed winch assembly and structural frame mounting'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-bf9X.png',
            title: 'Tensioner Mechanism CAD',
            caption: 'Dynamic tensioner assembly for cable slack prevention'
          }
        ]
      },
      {
        heading: '1D Prototype & FEA Validation',
        paragraphs: [
          'The 1D prototype was built in order to test mechanism designs without a large assembly space. The winches and tensioners were tested together and the results were used to redesign and iterate.',
          'FEA Validation was conducted on critical parts to ensure performance under worst case scenarios.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-4Ub9.png',
            title: '1D Test Bench CAD',
            caption: '1D prototype test fixture layout'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-cuIc.png',
            title: '1D Physical Test Bench',
            caption: 'Physical 1D test bench setup with motor and tension carriage'
          }
        ]
      },
      {
        heading: '1D FEA Structural Stress Analysis',
        imagesLayout: 'carousel',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-cable-robot-iteration-2-1698.png',
            title: 'Winch Plate FEA Stress Plot',
            caption: 'Winch mounting plate Von Mises stress distribution under peak line tension'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-cable-robot-iteration-2-82FZ.png',
            title: 'Tensioner Arm FEA',
            caption: 'Tensioner pivot arm deflection and stress analysis'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-cable-robot-iteration-2-ezkm.png',
            title: 'Corner Gantry Bracket FEA',
            caption: 'Structural corner bracket safety factor analysis'
          }
        ]
      },
      {
        heading: '1D Physical Prototyping & Mechanism Testing',
        imagesLayout: 'carousel',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-fkhn.jpg',
            title: 'Machined Winch Assembly',
            caption: 'Precision-machined aluminum winch drum and motor coupling'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-swKn.jpg',
            title: '1D Bench in Lab',
            caption: 'Bench testing line tracking and rapid directional reversals'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-Yb6H.jpg',
            title: 'Line Tension Testing',
            caption: 'Dynamic line payout and tension measurements'
          }
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=wF_lyKvVXN0',
            title: '1D Prototype High-Speed Tension & Winch Test'
          }
        ]
      },
      {
        heading: '2D Prototype Assembly & Sensorized Tensioner',
        paragraphs: [
          'After multiple design iterations and many days of manufacturing, the full 2D prototype of the 8\'x8\' cable robot was assembled and tested.',
          'The tensioner was updated to include a tension sensor so that software-based tension control could be used in addition or instead of the mechanical tensioner.'
        ],
        imagesLayout: 'grid-2-1',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-p4xs.png',
            title: 'Full 2D 8x8 Cable Robot Frame CAD',
            caption: '8ft x 8ft 2D planar cable robot full system CAD model'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-cable-robot-iteration-2-JUeS.png',
            title: 'Sensorized Tensioner CAD',
            caption: 'Tensioner module integrated with real-time load cell sensor'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10547/story-high-speed-drone-catching-cable-robot-iteration-2-4Cwy.jpg',
            title: 'Assembled 8x8 Gantry in Lab',
            caption: 'Full 8ft x 8ft assembled gantry frame and drive modules'
          }
        ]
      },
      {
        heading: 'High-Speed Testing & Dynamic Flight Trajectories',
        paragraphs: [
          'The following videos are examples of various tests we conducted to check accuracy, speed, and reliability of the robot. Various motions were tested to ensure the robot could move the payload in a variety of ways. The winch mechanism was consistent throughout testing, and the tension systems successfully kept the payload stable. Initial testing showed that consistent, accurate movements were possible, but further testing is required to determine the long-term performance at high speeds.'
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=7bPPvc_zwZ8',
            title: '2D Cable Robot High Speed Trajectory Test'
          },
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=pxpzhzksFc0',
            title: 'Multi-Axis Circular & Linear Path Tracking'
          },
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=3lTADzLLtf0',
            title: 'Rapid Deceleration & Arrest Demonstration'
          }
        ]
      }
    ],
    specs: [
      { label: 'Frame Envelope', value: '8\' × 8\' (2.44 m × 2.44 m)' },
      { label: 'Max Acceleration', value: '18 m/s² (1.84 G)' },
      { label: 'Tension Feedback', value: 'Integrated Real-Time Load Cell' },
      { label: 'Actuation', value: '4x High-Torque Brushless Servos' },
      { label: 'Target Drone Speed', value: 'Catching fixed wing at 20 mph' }
    ],
    materialsAndManufacturing: [
      'Modular Extruded Aluminum Gantry Frame',
      'CNC Milled 6061-T6 Aluminum Winch Plates & Brackets',
      'UHMWPE Braided Zero-Creep Line',
      'Custom Dynamic Mechanical Tensioner & Load Cell Sensor'
    ],
    keyChallenges: [
      'Eliminating cable slack during high-acceleration 2D direction reversals.',
      'Scaling from 1D testbench to full 8ft x 8ft shipping-container scale structure.'
    ],
    modelType: 'cable-robot-2',
    palette: {
      primary: '#cbd5e1',
      secondary: '#475569',
      accent: '#f97316',
      base: '#1e293b',
      details: '#0284c7'
    }
  },

  // 3. Autonomous Ping-Pong Dribbling and Bouncing Robot (Jan 2024 - May 2024)
  {
    id: 'ping-pong-robot',
    title: 'Autonomous Ping-Pong Dribbling and Bouncing Robot',
    subtitle: '2-DOF High-Bandwidth Dynamic Gimbal Platform',
    date: 'Jan 2024 – May 2024',
    dateRange: 'Jan 2024 – May 2024',
    year: 2024,
    company: 'UC Berkeley',
    companyLogo: '/berkeley-logo.png',
    companyUrl: 'https://www.berkeley.edu',
    tags: ['Robotics', 'Mechatronics', 'Control Systems', 'Computer Vision'],
    description: 'Designed and prototyped an autonomous ping-pong dribbling robot able to bounce a ping-pong ball on a 6" square platform for extended periods of time.',
    extendedDescription: [
      'Designed, manufactured, and prototyped a robot to dribble or bounce a ping-pong ball on a small, 6" square platform regardless of disturbances.'
    ],
    structuredSections: [
      {
        heading: 'Overview',
        paragraphs: [
          'I designed, manufactured, and prototyped a robot to dribble or bounce a ping-pong ball on a small, 6" square platform regardless of disturbances. The platform had to accelerate fast enough to bounce the ping-pong ball reliably, rotate to control the bounce trajectory, and be rigid enough to reliably predict and control the ball\'s movement. I worked with a team of students at UC Berkeley to integrate the design with electronics and software. My contributions included the entire mechanical design, stepper and servo motor circuitry design and implementation, and stepper motor control code.'
        ]
      },
      {
        heading: 'Solution',
        paragraphs: [
          'Linear movement was controlled by stepper motors and belts actuating two linear slides. Belts allowed for faster acceleration and accuracy compared to rack and pinions and their backlash, or lead screws and their limited acceleration ability. Platform rotation was actuated with a direct driven gimbal system by two servos for fast and accurate movements.',
          'Ball position tracking was completed with a webcam and computer vision to obtain the x, y, and z coordinates. The platform was controlled with a PID loop, taking the ball position and trajectory to change the platform position and angle to keep the ball on the platform while bouncing.'
        ]
      },
      {
        heading: 'Initial Concept',
        paragraphs: [
          'Initially, we hoped to dribble the ping-pong ball on the ground while moving around a room, similar to how a basketball player would dribble around the court. This concept included a drive train with mecanum wheels for omni-directional movement and an initial gimbal and linear actuation system.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10548/story-autonomous-pingpong-dribbling-and-bouncing-robot-cjSf.JPG',
            title: 'Initial Omni-Directional Mecanum Mobile Concept',
            caption: 'CAD model of initial mobile dribbling concept with mecanum drive base'
          }
        ]
      },
      {
        heading: 'Prototyping & Dual NEMA-23 Iteration',
        paragraphs: [
          'The initial concept was changed to a stationary frame in order to reduce project complexity and increase feasibility for the project timeline.',
          'The singular stepper motor didn\'t provide sufficient torque or acceleration for our needs, so I designed another iteration using two NEMA-23 steppers.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10548/story-autonomous-pingpong-dribbling-and-bouncing-robot-bGhA.png',
            title: 'Single Motor Linear Stage Prototype',
            caption: 'First iteration stationary frame with single stepper drive'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10548/story-autonomous-pingpong-dribbling-and-bouncing-robot-r6rC.png',
            title: 'Dual NEMA-23 High-Acceleration Platform',
            caption: 'Upgraded dual NEMA-23 belt-driven linear actuation stage'
          }
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=bBfGa0vfWao',
            title: 'Linear Stage Velocity & Impulse Testing'
          }
        ]
      },
      {
        heading: 'Final Prototype & 2-Hour Autonomous Demonstration',
        paragraphs: [
          'After multiple component iterations, the final prototype and control code was successfully implemented. The ping-pong ball stayed on the platform regardless of disturbances such as bounces, wind, and human interference. The longest time we ran the robot was 2 hours, in which the robot ran flawlessly, keeping the ball on the platform without any restart of the program or additional tuning.'
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=tn6nV-CjQjs',
            title: 'Continuous Autonomous Ping-Pong Bouncing Demonstration'
          }
        ]
      }
    ],
    specs: [
      { label: 'Continuous Operation', value: '2 Hours Uninterrupted' },
      { label: 'Paddle Size', value: '6" × 6" Platform' },
      { label: 'Linear Actuators', value: '2x NEMA-23 Stepper Motors + Belts' },
      { label: 'Gimbal Actuation', value: 'Dual Coreless Servo Direct Drive' },
      { label: 'Tracking', value: 'Computer Vision 3D Ball Coordinate Feed' }
    ],
    materialsAndManufacturing: [
      'Dual Precision Linear Rail Guides with GT2 Timing Belts',
      'CNC Machined Aluminum Gimbal Yokes',
      'Lightweight Honeycomb Composite Paddle',
      'Laser-Cut Acrylic Electronics Mounting Chassis'
    ],
    keyChallenges: [
      'Achieving high vertical acceleration with zero mechanical backlash to consistently impart impulse to the ping-pong ball.',
      'Real-time OpenCV ball tracking and trajectory prediction under variable ambient lighting.'
    ],
    modelType: 'ping-pong',
    palette: {
      primary: '#e2e8f0',
      secondary: '#64748b',
      accent: '#ea580c',
      base: '#334155',
      details: '#059669'
    }
  },

  // 4. Ocean Drone Catamaran for TAFLab (Aug 2023 - Jan 2024)
  {
    id: 'catamaran-ocean-drone',
    title: 'Ocean Drone Catamaran for TAFLab',
    subtitle: 'Autonomous Sailing Surface Vessel for Marine Data',
    date: 'Aug 2023 – Jan 2024',
    dateRange: 'Aug 2023 – Jan 2024',
    year: 2024,
    company: 'TAFLab (UC Berkeley)',
    companyLogo: '/berkeley-logo.png',
    companyUrl: 'https://taflab.berkeley.edu',
    tags: ['Marine Systems', 'Autonomous Vehicles', 'CFD', 'Composites'],
    description: 'Designed automated ocean sail drones, increasing sailing efficiency and controllability.',
    extendedDescription: [
      'As a part of the Theoretical & Applied Fluid Dynamics Laboratory, I manufactured and iterated on an autonomous sailboat to eventually be a part of a drone swarm to conduct wave prediction.'
    ],
    structuredSections: [
      {
        heading: 'Overview',
        paragraphs: [
          'As a part of the Theoretical & Applied Fluid Dynamics Laboratory, I manufactured and iterated on an autonomous sailboat, to eventually be a part of a drone swarm to conduct wave prediction.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-pxlv.png',
            title: 'TAFLab Autonomous Catamaran CAD',
            caption: 'Wave-piercing catamaran hull with rigid wingsail and tail-vane assembly'
          }
        ]
      },
      {
        heading: 'Initial Prototype & Composite Layups',
        paragraphs: [
          'The initial prototype was made using composite layups to create the fiberglass hulls and sails. Two rudders were controlled using a servo, and the main sail was rotated using a baby sail.'
        ],
        imagesLayout: 'grid-2-1',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-rgAv.jpg',
            title: 'Hull Composite Layup',
            caption: 'Hand-laid fiberglass catamaran hull mold'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-EoyX.jpg',
            title: 'Rigid Wingsail Composite Layup',
            caption: 'Composite layup process for rigid wingsail'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-WG9n.png',
            title: 'Assembled Catamaran Structure',
            caption: 'Twin hull bridge structure and mast pivot mount'
          }
        ]
      },
      {
        heading: 'Iteration & Bearing Housing Redesign',
        paragraphs: [
          'The initial prototype had issues with controlled rotation of the mainsail and straight-line, point-to-point sailing.',
          'To address this issue, I prototyped and implemented the actuation of the rudders and baby sail for a solid initial functioning prototype and water test. However, early testing revealed that high friction in the mast bearings prevented smooth actuation and control of the mainsail.',
          'I redesigned the bearing housings to increase the spacing and stability of the mast. This successfully reduced friction enough to enable the smaller baby sail to rotate the mainsail into more optimal sailing orientations. Further testing and iteration led to improvements including rotation constraints and detent mechanisms for additional control.',
          'Through component integration, prototyping, test stand experiments, and on-water trials, I was able to demonstrate reliable control over sailing direction by actuating the main sail with the baby sail system. These upgrades provide a more controllable foundation to facilitate future sensing, automation algorithms, and performance advancements toward an autonomous robotic sailing platform.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-f4mc.png',
            title: 'Redesigned Bearing Housing CAD',
            caption: 'Optimized mast bearing spacing and low-friction housing geometry'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8940/story-ocean-drone-catamaran-for-taflab-ii5C.png',
            title: 'Rudder Actuation Linkage CAD',
            caption: 'Dual synchronized rudder steering linkage'
          }
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=s7Ifoe6i6nc',
            title: 'On-Water Sailing & Baby Sail Aerodynamic Trim Test'
          }
        ]
      }
    ],
    specs: [
      { label: 'Hull Configuration', value: 'Twin Wave-Piercing Catamaran Hulls' },
      { label: 'Sail System', value: 'Rigid Wingsail actuated via Baby Sail' },
      { label: 'Steering', value: 'Dual Synchronized Servos + Rudders' },
      { label: 'Manufacturing', value: 'Fiberglass Vacuum Layup & CNC Delrin' },
      { label: 'Application', value: 'Autonomous Wave Prediction Drone Swarm' }
    ],
    materialsAndManufacturing: [
      'Fiberglass / Epoxy Molded Catamaran Hulls',
      'Rigid Airfoil Composite Wingsail & Trim Tab',
      'Low-Friction Delrin Mast Bearing Assemblies',
      'Waterproof Sealed Electronics Enclosures'
    ],
    keyChallenges: [
      'Eliminating parasitic rotational friction on the mast bearings to allow a small aerodynamic tail sail to trim the main wingsail.',
      'Ensuring watertight hull integrity and balance across dynamic wave loading.'
    ],
    modelType: 'catamaran',
    palette: {
      primary: '#3b82f6',
      secondary: '#f8fafc',
      accent: '#e11d48',
      base: '#0f172a',
      details: '#eab308'
    }
  },

  // 5. High-Speed Cable Robot to Catch Drones (Aug 2023 - Dec 2023)
  {
    id: 'drone-catch-cable-robot',
    title: 'High-Speed Cable Robot to Catch Drones',
    subtitle: '3000 RPM Dynamic Recovery Winch System',
    date: 'Aug 2023 – Dec 2023',
    dateRange: 'Aug 2023 – Dec 2023',
    year: 2023,
    company: 'Sentien Robotics',
    companyLogo: 'https://media.licdn.com/dms/image/v2/D560BAQG-jDLP_8B52g/company-logo_200_200/company-logo_200_200/0/1728988379666/sentien_robotics_logo?e=1788998400&v=beta&t=bbhNRf0apD7CQa7Bgrr4AxpBwAPcelxmJsSM7K7XP4w',
    companyUrl: 'https://www.sentienrobotics.com',
    tags: ['High Speed', 'Winch Mechanics', 'Drone Recovery', 'Mechanical Design'],
    description: 'Designed and prototyped a planar cable robot, including a robust winch system running at up to 3000 rpm, to reliably catch midflight automated drones landing at 20 mph.',
    extendedDescription: [
      'Our team was tasked with designing and prototyping a planar cable robot capable of catching mid-flight automated drones landing at 20 mph. I designed the winch system, which needed to be robust, running at up to 3000 rpm, and spool uniformly and consistently while smoothly interfacing with the pulley system.'
    ],
    structuredSections: [
      {
        heading: 'Overview & Solution',
        paragraphs: [
          'Our team was tasked with designing and prototyping a planar cable robot capable of catching mid-flight automated drones landing at 20 mph. I designed the winch system, which needed to be robust, running at up to 3000 rpm, and spool uniformly and consistently while smoothly interfacing with the pulley system.',
          'I designed, machined, and assembled a frame and motor pods that allowed for easy spooling and unspooling of cable. I designed a winch that spooled wire into grooves in a single layer around the drum. To prevent tangling, a pulley translates and guides the wire along with the spooling or unspooling rotation.'
        ]
      },
      {
        heading: 'Concept Generation',
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-KKPj.png',
            title: 'Winch Spooling Concept',
            caption: 'Grooved drum winch concept for single-layer cable lay'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-7n3u.png',
            title: 'Translating Guide Pulley Concept',
            caption: 'Reciprocating guide pulley layout to eliminate cable tangling'
          }
        ]
      },
      {
        heading: 'CAD & Engineering Assembly',
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-Qi0S.JPG',
            title: 'Winch & Motor Pod Assembly CAD',
            caption: 'Detailed 3D assembly CAD of 3000 RPM winch mechanism with motor pods'
          }
        ]
      },
      {
        heading: 'Prototypes & High-Speed Dynamic Testing',
        imagesLayout: 'grid-2-1',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-tP6Z.png',
            title: 'Machined Winch Assembly',
            caption: 'Machined aluminum grooved winch drum and guide rod'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-XeDs.jpg',
            title: 'Motor Pod Test Rig',
            caption: 'High-speed motor pod on test frame'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8937/story-highspeed-cable-robot-to-catch-drones-Ffyw.jpg',
            title: 'Full Frame Cable Rig in Testing',
            caption: 'High-speed cable trajectory intercept test'
          }
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=H41Bj0lks0U',
            title: '3000 RPM Winch High-Speed Spooling Test'
          },
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=nL89zjuW9EQ',
            title: 'Planar Cable Robot High-Speed Arrest Demonstration'
          }
        ]
      }
    ],
    specs: [
      { label: 'Winch Max RPM', value: '3,000 RPM' },
      { label: 'Catch Velocity', value: '20 mph (9.0 m/s)' },
      { label: 'Spooling Type', value: 'Single-Layer Grooved Drum' },
      { label: 'Anti-Tangle Guide', value: 'Synchronized Translating Pulley' },
      { label: 'Application', value: 'Autonomous Mid-Flight Fixed-Wing Drone Catch' }
    ],
    materialsAndManufacturing: [
      '6061-T6 CNC Machined Grooved Winch Drum',
      'High-Speed Ceramic Hybrid ABEC-7 Bearings',
      'Structural Steel Spaceframe Anchor Mounts',
      'UHMWPE Braided Line'
    ],
    keyChallenges: [
      'Preventing line overlap and bird-nesting at 3000 RPM dynamic deceleration.',
      'Minimizing rotational inertia to enable sub-80ms motor acceleration.'
    ],
    modelType: 'drone-catch',
    palette: {
      primary: '#475569',
      secondary: '#94a3b8',
      accent: '#dc2626',
      base: '#1e293b',
      details: '#f59e0b'
    }
  },

  // 6. Construction Robot Stability Outrigger Simulation (May 2023 - Aug 2023)
  {
    id: 'construction-outrigger-fea',
    title: 'Construction Robot Stability Outrigger Simulation',
    subtitle: 'FEA and Dynamic Simulation for 1500 lb Robotic Platform',
    date: 'May 2023 – Aug 2023',
    dateRange: 'May 2023 – Aug 2023',
    year: 2023,
    company: 'Raise Robotics',
    companyLogo: 'https://raiserobotics.ai/wp-content/uploads/2023/05/RaiseRobotics_PictorialMark_BrandColors_Alt.png',
    companyUrl: 'https://raiserobotics.ai/',
    tags: ['FEA Simulation', 'Structural Analysis', 'Hydraulics', 'Heavy Machinery'],
    description: 'Conducted FEA and dynamic simulation for the development of a stability outrigger system for a 1500 lb construction robot.',
    extendedDescription: [
      'Raise Robotics was switching to a new tracked mobile base from the previous mecanum wheel mobile base. I was tasked with integrating the new mobile base into the existing robot assemblies and preparing the model for URDF simulation and real-world assembly and deployment.'
    ],
    structuredSections: [
      {
        heading: 'Overview',
        paragraphs: [
          'Raise Robotics was switching to a new tracked mobile base from the previous mecanum wheel mobile base. I was tasked with integrating the new mobile base into the existing robot assemblies and preparing the model for URDF simulation and real-world assembly and deployment. I quickly noticed a design flaw where the robot would easily tip over. I then collaborated with other engineers to develop a stability outrigger system with actuated legs. Overall, I greatly increased simulation accuracy and stability of the robot.'
        ]
      },
      {
        heading: 'Tracked Mobile Base Integration',
        paragraphs: [
          'I didn\'t have access to a 3D model of the tracked base at first, so I manually converted an AutoCAD file into an Inventor model, extrapolating dimensions when necessary. Later I received more detailed drawings and parts, and these were integrated into the model.'
        ],
        imagesLayout: 'grid-2-1',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8934/story-stability-outrigger-system-simulation-and-development-vqt9.jpg',
            title: 'Tracked Base Physical Machine',
            caption: 'Physical tracked construction robot base'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8934/story-stability-outrigger-system-simulation-and-development-utyr.png',
            title: 'AutoCAD to Inventor CAD Conversion',
            caption: 'Reconstructed 3D CAD model of tracked drive assembly'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8934/story-stability-outrigger-system-simulation-and-development-uCd0.png',
            title: 'Detailed Tracked Assembly CAD',
            caption: 'Integrated tracked mobile base assembly model'
          }
        ]
      },
      {
        heading: 'URDF Preparation & Model Verification',
        paragraphs: [
          'I removed the previous mobile base and replaced it with the new tracked base model I created. Next, I addressed issues with the assembly in order to increase model accuracy.',
          'Model Mates: Many constraints were broken or didn\'t exist due to past exports into different software versions. I carefully reviewed all of the model mates in each assembly and made adjustments where necessary to ensure that they were accurate and properly aligned.',
          'Geometries: I reviewed all of the geometries in each subassembly and made adjustments where necessary to ensure that they matched the real-world dimensions of each part. Multiple parts were outdated, which I replaced with newer assemblies, fixing mates when necessary.',
          'Mass/Material Assignments: Finally, I reviewed all of the mass/material assignments of each subassembly and made adjustments where necessary to ensure that they accurately reflected reality.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8934/story-construction-robot-stability-outrigger-simulation-qhd2.png',
            title: 'Full Robot URDF Dynamic Model',
            caption: 'Full 1500 lb robot model with mass matrix and joint constraints for simulation'
          }
        ]
      },
      {
        heading: 'Stability Simulation & Dynamic Tipping Analysis',
        paragraphs: [
          'Assigning materials and weights to every subassembly meant that the center of gravity was not much more accurate. I noticed that due to the track geometry and location of the center of gravity, the robot would likely be prone to tipping. Thus, I decided to run multiple dynamic simulations in order to determine how to prevent tipping. I simulated assuming the arms were rotating at max torque and an approximate friction coefficient.',
          'I repeated the simulation with multiple counterweights, but due to the robot\'s already high mass, any effective counterweight would greatly impact the max load of the mobile base, and would not increase stability significantly. I repeated the simulations with accurate suspension damping, and the results were the same.'
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=gG62t-yrwMA',
            title: 'Dynamic Tipping Simulation under Max Arm Torque'
          }
        ]
      },
      {
        heading: 'Outrigger Development & FEA',
        paragraphs: [
          'I collaborated with other engineers to design a stability outrigger system with actuated legs. I conducted FEA and further dynamic simulations to determine the optimal geometry and attachment structure. I also researched various actuation methods such as pneumatics and electric linear actuators, optimizing for system complexity, energy efficiency, precision, strength, and speed.'
        ]
      }
    ],
    specs: [
      { label: 'Robot Weight', value: '1,500 lbs (680 kg)' },
      { label: 'Outrigger Load', value: '2,200 lbf vertical per leg' },
      { label: 'Simulation Tools', value: 'Inventor Dynamic Simulation & FEA' },
      { label: 'Actuator Trade Study', value: 'Pneumatics vs Electric Linear Actuators' },
      { label: 'Model Accuracy', value: '100% verified mates, mass, and center of gravity' }
    ],
    materialsAndManufacturing: [
      'High-Strength Structural Steel Box Trussing',
      'Heavy-Duty Actuated Outrigger Legs',
      'Multi-Terrain Swivel Foot Pads',
      'Dynamic URDF Physics Kinematic Models'
    ],
    keyChallenges: [
      'Accurately extrapolating 2D AutoCAD blueprints into 3D CAD with exact mass moments of inertia.',
      'Resolving dynamic tipping moments without exceeding tracked mobile base maximum load ratings.'
    ],
    modelType: 'outrigger',
    palette: {
      primary: '#ca8a04',
      secondary: '#334155',
      accent: '#2563eb',
      base: '#0f172a',
      details: '#e2e8f0'
    }
  },

  // 7. Modular Bracket Gripper (May 2023 - Aug 2023)
  {
    id: 'modular-bracket-gripper',
    title: 'Modular Bracket Gripper',
    subtitle: 'Pneumatic End-Effector for Automated Steel Assembly',
    date: 'May 2023 – Aug 2023',
    dateRange: 'May 2023 – Aug 2023',
    year: 2023,
    company: 'Raise Robotics',
    companyLogo: 'https://raiserobotics.ai/wp-content/uploads/2023/05/RaiseRobotics_PictorialMark_BrandColors_Alt.png',
    companyUrl: 'https://raiserobotics.ai/',
    tags: ['Mechatronics', 'Automation', 'CNC Machining', 'Robotic Grippers'],
    description: 'Designed a modular robotic gripper to reliably hold and position 5 lb aluminum brackets during automated construction tasks.',
    extendedDescription: [
      'Large J Brackets are used to install curtain wall facades on the edge of buildings. Typically, this requires a human to install these metal brackets hanging off the side for each bracket. Raise Robotics is developing a robot to complete these dangerous and repetitive tasks.'
    ],
    structuredSections: [
      {
        heading: 'Overview',
        paragraphs: [
          'Large J Brackets are used to install curtain wall facades on the edge of buildings. Typically, this requires a human to install these metal brackets hanging off the side for each bracket. Raise Robotics is developing a robot to complete these dangerous and repetitive tasks. Thus, a solution is needed to hold onto these brackets so they can be fastened to the side of the building.',
          'My task was to design a gripper that can be used to grab and place the J bracket from the bracket’s loading position into its placement position.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-fztA.png',
            title: 'J Bracket Gripper Concept',
            caption: 'Gripper engagement with curtain wall J bracket'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-JDAk.png',
            title: 'Placement Positioning CAD',
            caption: 'Gripper positioning bracket against building edge'
          }
        ]
      },
      {
        heading: 'Modular Design & Rapid Prototyping Solution',
        paragraphs: [
          'I designed a modular gripper intended for easy prototyping and iteration. It is made from 4 aluminum plates that can be waterjet or plasma cut with minimal material waste, and adhered or welded together. I also designed the gripper to have a modular gripping surface. I created a rubber gripping surface that can be screwed onto the gripper brackets as shown in the assembly drawings. A different part made of different materials or different surface textures can easily be designed with holes in the correct places to replace this rubber pad.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-tX09.JPG',
            title: 'Waterjet Plate Construction CAD',
            caption: 'Modular 4-plate aluminum construction layout'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-5iCR.JPG',
            title: 'Replaceable Rubber Pad Interface',
            caption: 'Modular screw-mounted high-friction rubber pad interface'
          }
        ]
      },
      {
        heading: 'Physical Manufacturing & Testing Gallery',
        imagesLayout: 'carousel',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-xmnr.jpg',
            title: 'Waterjet Cut Aluminum Plates',
            caption: 'Precision waterjet cut plates ready for deburring and assembly'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-tKay.jpg',
            title: 'Assembled Gripper Unit',
            caption: 'Assembled modular gripper with pneumatic cylinder linkage'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/5229/story-modular-bracket-gripper-avkm.jpg',
            title: 'J-Bracket Clamp Test',
            caption: 'Retention load and slip test under simulated placement loads'
          }
        ]
      }
    ],
    specs: [
      { label: 'Target Payload', value: '5 lb Aluminum Architectural J-Bracket' },
      { label: 'Manufacturing', value: '4 Waterjet / Plasma Cut Aluminum Plates' },
      { label: 'Interface', value: 'Replaceable Rubber Modular Grip Pad' },
      { label: 'Actuation', value: 'Pneumatic Clamp Cylinder' },
      { label: 'Application', value: 'Curtain Wall Facade High-Rise Robot' }
    ],
    materialsAndManufacturing: [
      '6061-T6 Aluminum Waterjet Cut Structural Plates',
      'High-Friction Molded Rubber Modular Jaw Inserts',
      'Pneumatic Actuator Linkage with Hardened Pivot Pins',
      'Fast-Turnaround Welded and Fastened Assembly'
    ],
    keyChallenges: [
      'Creating a zero-slip gripper interface that can be manufactured in-house rapidly with minimal CNC setup time.',
      'Accommodating loose raw extrusion tolerances of architectural curtain wall brackets.'
    ],
    modelType: 'modular-gripper',
    palette: {
      primary: '#94a3b8',
      secondary: '#1e293b',
      accent: '#3b82f6',
      base: '#475569',
      details: '#ef4444'
    }
  },

  // 8. Autonomous Underwater Robot (Aug 2022 - May 2023)
  {
    id: 'autonomous-underwater-robot',
    title: 'Autonomous Underwater Robot',
    subtitle: 'Sub-Surface Torpedo Launcher, Dropper, and Gripper',
    date: 'Aug 2022 – May 2023',
    dateRange: 'Aug 2022 – May 2023',
    year: 2023,
    company: 'RoboSub (UC Berkeley)',
    companyLogo: '/robosub-logo.png',
    tags: ['Marine Robotics', 'Pressure Vessels', 'Pneumatics', 'Waterproofing'],
    description: 'Developed an underwater torpedo launcher, dropper, and gripper for the RoboSub autonomous underwater vehicle competition.',
    extendedDescription: [
      'The 2022-2023 RoboSub challenge required a torpedo launcher, weight dropper, and object gripper in order to complete the autonomous underwater tasks.'
    ],
    structuredSections: [
      {
        heading: 'RoboSub Challenge',
        paragraphs: [
          'The 2022-2023 RoboSub challenge required a torpedo launcher, weight dropper, and object gripper in order to complete the autonomous underwater tasks.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-underwater-torpedo-launcher-fhlL.JPG',
            title: 'RoboSub AUV System CAD',
            caption: 'Autonomous Underwater Vehicle full assembly CAD'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-HUXm.JPG',
            title: 'Physical RoboSub in Water Testing',
            caption: 'RoboSub in pool testing with torpedo launcher and gripper mounted'
          }
        ]
      },
      {
        heading: 'Torpedo Launcher (Hydrodynamic Spring System)',
        paragraphs: [
          'I developed an underwater torpedo launcher that is accurate within 5 inches at 4 feet distance. I designed the torpedo launcher to use one servo to launch two torpedoes. If the servo rotates in one direction, it releases one torpedo which is launched using a compressed spring. If the servo rotates in the opposite direction, the second torpedo will be launched.',
          'When designing the spring mechanism I conducted extensive calculations to ensure that the torpedoes would travel four feet at a reasonably high speed and accuracy. I used a damped mass-spring system to simulate the spring and torpedo with drag from the water. Using the release velocity from the spring, I calculated the trajectory of the torpedo underwater using a simplified torpedo geometry to approximate the drag coefficient. This allowed an informed decision of the ideal spring rate, max load, and length.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-1pCg.JPG',
            title: 'Torpedo Launcher CAD Assembly',
            caption: 'Dual torpedo release mechanism with single bidirectional servo'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-sNV5.JPG',
            title: 'Assembled Torpedo Launcher',
            caption: '3D-printed and assembled torpedo launcher tubes'
          }
        ]
      },
      {
        heading: 'Dropper Mechanism',
        paragraphs: [
          'I designed a dropper mechanism that can drop two weights accurately from a two foot distance into a container. Rotating the servo in one direction would drop a weight, and rotating it in the opposite direction would drop the second weight.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-fRJF.JPG',
            title: 'Dropper Mechanism CAD',
            caption: 'Reversible servo dual payload release dropper CAD'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-kgOz.JPG',
            title: 'Assembled Dropper Hardware',
            caption: 'Physical dropper module mounted to sub frame'
          }
        ]
      },
      {
        heading: 'Rack and Pinion Gripper & Waterproofing',
        paragraphs: [
          'The AUV had to grab a large, flat sided object from a flat surface. I designed a rack and pinion gripper in order to pick up these objects. Running the motor would rotate the gear, moving one gripper wall closer to the other, until it gripped the object.',
          'Waterproofing: We used servos waterproof rated for splashes and short underwater periods, so further waterproofing was required. I researched and waterproofed each servo using mineral oil, O-rings, epoxy, and lubricant.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-cb8b.JPG',
            title: 'Rack and Pinion Gripper CAD',
            caption: 'Rack and pinion parallel jaw gripper CAD'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8786/story-autonomous-underwater-robot-79bz.JPG',
            title: 'Assembled Underwater Gripper',
            caption: 'Physical gripper module with custom waterproofing seals'
          }
        ]
      }
    ],
    specs: [
      { label: 'Torpedo Accuracy', value: 'Within 5" at 4 ft underwater' },
      { label: 'Actuation Design', value: '1 Bidirectional Servo launches 2 Torpedoes' },
      { label: 'Dropper System', value: '1 Bidirectional Servo drops 2 Weights' },
      { label: 'Gripper Type', value: 'Motorized Rack & Pinion Parallel Jaw' },
      { label: 'Waterproofing', value: 'Mineral Oil Submersion, O-Rings, & Epoxy Seals' }
    ],
    materialsAndManufacturing: [
      '3D-Printed ABS / Polycarbonate Torpedo Barrels',
      'Stainless Steel 302 Compression Springs (Damped Model Calculated)',
      'Mineral Oil Filled Waterproofed Servos',
      'Laser-Cut Delrin Rack and Pinion Gears'
    ],
    keyChallenges: [
      'Hydrodynamic damping trajectory calculation to accurately hit subsea targets from 4 feet away.',
      'Achieving long-term submersion waterproofing for low-cost servos with mineral oil filling and dynamic O-ring seals.'
    ],
    modelType: 'underwater-robot',
    palette: {
      primary: '#0284c7',
      secondary: '#0f172a',
      accent: '#eab308',
      base: '#334155',
      details: '#10b981'
    }
  },

  // 9. Anti-Tangle Winch for Drone Fleet (Jan 2023 - May 2023)
  {
    id: 'anti-tangle-drone-winch',
    title: 'Anti-Tangle Winch for Drone Fleet',
    subtitle: 'Diamond-Screw Reciprocating Level-Wind Mechanism',
    date: 'Jan 2023 – May 2023',
    dateRange: 'Jan 2023 – May 2023',
    year: 2023,
    company: 'Sentien Robotics',
    companyLogo: 'https://media.licdn.com/dms/image/v2/D560BAQG-jDLP_8B52g/company-logo_200_200/company-logo_200_200/0/1728988379666/sentien_robotics_logo?e=1788998400&v=beta&t=bbhNRf0apD7CQa7Bgrr4AxpBwAPcelxmJsSM7K7XP4w',
    companyUrl: 'https://www.sentienrobotics.com',
    tags: ['Mechanism Design', 'Level-Wind', 'Winch Systems', 'Reliability Engineering'],
    description: 'Developed and manufactured an anti-tangle winch for Sentien’s drone fleet, reducing bird nesting and increasing uniform winding distribution.',
    extendedDescription: [
      'Sentien, a drone fleet company, faced issues with their winch system due to bird nesting and tangling. These problems caused delays in operations and decreased the reliability of their drones. They needed a low-cost solution that was durable against the force applied from loading and solved these issues.'
    ],
    structuredSections: [
      {
        heading: 'Overview & Problem Statement',
        paragraphs: [
          'Sentien, a drone fleet company, faced issues with their winch system due to bird nesting and tangling. These problems caused delays in operations and decreased the reliability of their drones. They needed a low-cost solution that was durable against the force applied from loading and solved these issues.',
          'I took on the challenge of developing and manufacturing an anti-tangle winch for Sentien\'s drone fleet using SolidWorks, 3D printed prototypes, and FEA to improve function and reliability.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8936/story-developing-antitangle-winch-for-drone-fleet-k1rl.JPG',
            title: 'Anti-Tangle Winch CAD',
            caption: 'Reciprocating level-wind screw winch assembly CAD'
          }
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=kzrlA5E0D6w',
            title: 'Previous Winch Bird-Nesting Jamming Problem'
          }
        ]
      },
      {
        heading: 'Solution & Concept Generation',
        paragraphs: [
          'I began by analyzing the current winch system used by Sentien\'s drones. We identified bird nesting as the primary issue causing tangling. To solve this problem, I designed a new winch system that increased uniform winding distribution using a reciprocating screw mechanism.',
          'After several rounds of testing and modifications, I was able to develop an anti-tangle winch that increased reliability by over 2x compared to the previous system. Our solution was also lightweight, durable against loading force, and cost-effective for Sentien\'s needs.'
        ],
        imagesLayout: 'grid-2',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8936/story-developing-antitangle-winch-for-drone-fleet-Idz5.png',
            title: 'Diamond Reversing Screw Concept',
            caption: 'Double-helical diamond reversing level-wind screw mechanism'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8936/story-developing-antitangle-winch-for-drone-fleet-Uh9U.png',
            title: 'Spool Synchronization Geartrain',
            caption: 'Direct gear drive synchronizing spool rotation to level-wind traverse'
          }
        ]
      },
      {
        heading: 'Initial Prototypes & Impact',
        paragraphs: [
          'Impact Summary:',
          '• Increased winch reliability by over 2x compared to the previous system.',
          '• Completely eliminated bird-nesting and tangling failures during high-speed tether retraction.',
          '• Significantly reduced turnaround delays for Sentien autonomous drone fleet operations.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8936/story-developing-antitangle-winch-for-drone-fleet-t70a.png',
            title: 'Prototype Winch on Test Stand',
            caption: '3D printed and machined prototype during automated cycle testing'
          }
        ]
      }
    ],
    specs: [
      { label: 'Reliability Improvement', value: '> 2x Over Previous System' },
      { label: 'Mechanism', value: 'Double-Helical Diamond Reversing Screw' },
      { label: 'Winding Distribution', value: 'Synchronized Uniform Multi-Layer Traverse' },
      { label: 'Application', value: 'Sentien Autonomous Drone Fleet Tether Winch' }
    ],
    materialsAndManufacturing: [
      'Turned 4140 Hardened Steel Diamond Screw',
      'Precision Brass Reversing Pawl Follower',
      'Aircraft-Grade 6061-T6 Aluminum Side Plates',
      '3D-Printed Rapid Iteration Prototypes'
    ],
    keyChallenges: [
      'Machining smooth crossover track turnaround geometry on the reversing screw to prevent pawl binding.',
      'Matching traverse pitch to exact cable diameter across multi-layer builds.'
    ],
    modelType: 'anti-tangle-winch',
    palette: {
      primary: '#64748b',
      secondary: '#d97706',
      accent: '#2563eb',
      base: '#1e293b',
      details: '#475569'
    }
  },

  // 10. Scrubtious: Convenient, Reusable, Bottle Scrubber (Aug 2022 - Dec 2022)
  {
    id: 'scrubtious-bottle-scrubber',
    title: 'Scrubtious: Convenient, Reusable, Bottle Scrubber',
    subtitle: 'Consumer Product Design and Injection Molding DFM',
    date: 'Aug 2022 – Dec 2022',
    dateRange: 'Aug 2022 – Dec 2022',
    year: 2022,
    company: 'UC Berkeley',
    companyLogo: '/berkeley-logo.png',
    companyUrl: 'https://www.berkeley.edu',
    tags: ['Product Design', 'DFM', 'Injection Molding', 'Sustainability'],
    description: 'Created a more convenient, reusable, and user friendly bottle scrubber, making use of off the shelf sponges so you don\'t need to buy additional replacements.',
    extendedDescription: [
      'Many bottle brushes on the market fail to guarantee a complete clean, are hard to control, and are made for specific bottles or cups. This often means that people need multiple brushes for multiple bottles, and the bulkiness of these brushes can allow users to miss spots on the wall of larger cups or bottles. Additionally, many of these brushes have irreplaceable brushes or sponges, making them environmentally unfriendly.'
    ],
    structuredSections: [
      {
        heading: 'Overview & Market Problem',
        paragraphs: [
          'Many bottle brushes on the market fail to guarantee a complete clean, are hard to control, and are made for specific bottles or cups. This often means that people need multiple brushes for multiple bottles, and the bulkiness of these brushes can allow users to miss spots on the wall of larger cups or bottles. Additionally, many of these brushes have irreplaceable brushes or sponges, making them environmentally unfriendly.'
        ]
      },
      {
        heading: 'The Solution',
        paragraphs: [
          'To solve this problem, we created Scrubtious to attach to any standard Scrub Daddy or Scrub Mommy and makes it easier to clean all the walls of the bottle. The brush spins as it\'s pushed down to make sure it gets every section of the inside, including the bottom. The spring in between the handle and the cap makes sure it pops back up when released.',
          'It can be used on multiple different sized bottles since the cap is tapered to fit tops with different diameters ranging from 2 to 4 inches. It uses a sponge that already exists and is at many popular stores so it can be easily replaced or taken off the holder to be used to clean other dishes and surfaces. It can accommodate both small and large bottles and the removable sponge attachment saves money and reduces plastic waste. Simply place the mechanism on the bottle and push down, and any bottle can be cleaned.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://showspace.so/_next/image?url=https%3A%2F%2Fchmqmeyyaiwfybqgcdoy.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fprojects%2F10276%2Fthumbnail-scrubtious-eco-friendly-versatile-bottle-brush-Eh.jpg&w=1920&q=50',
            title: 'Scrubtious Product Render',
            caption: 'Scrubtious universal spinning bottle scrubber with replaceable sponge head'
          }
        ]
      },
      {
        heading: 'Design & Mechanism Prototyping Carousel',
        imagesLayout: 'carousel',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-41e0.png',
            title: 'Helical Push-Spin Mechanism CAD',
            caption: 'Helical drive shaft converting downward push stroke to rotary scrub action'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-pOKf.png',
            title: 'Tapered Universal Bottle Cap CAD',
            caption: 'Tapered alignment collar fitting bottle openings from 2" to 4" diameter'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-Bf5B.png',
            title: 'Internal Spring Return Assembly',
            caption: 'Internal compression spring return mechanism'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-ohTg.png',
            title: 'Sponge Collet Attachment',
            caption: 'Removable sponge holder compatible with standard Scrub Daddy sponges'
          },
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/10276/story-scrubtious-convenient-reusable-bottle-scrubber-9oCy.png',
            title: 'Complete Exploded Assembly View',
            caption: 'Exploded CAD view showing all injection moldable components'
          }
        ]
      }
    ],
    specs: [
      { label: 'Bottle Fit Range', value: '2" to 4" Diameter Openings' },
      { label: 'Mechanism', value: 'Helical Push-Down Rotary Scrub + Spring Return' },
      { label: 'Sponge Compatibility', value: 'Standard Off-The-Shelf Scrub Daddy / Scrub Mommy' },
      { label: 'Sustainability', value: 'Zero plastic sponge waste (Reusable handle)' },
      { label: 'Manufacturing', value: 'DFM optimized for High-Volume Injection Molding' }
    ],
    materialsAndManufacturing: [
      'Injection Molded Polypropylene (PP) Body & Handle',
      'Stainless Steel 304 Return Spring',
      'Soft-Touch Overmolded TPE Grip Collar',
      'Food-Grade Dishwasher Safe Materials'
    ],
    keyChallenges: [
      'Designing a push-to-spin helical drive mechanism that works smoothly with wet, soapy hands.',
      'Universal self-centering collar geometry accommodating diverse bottle neck profiles.'
    ],
    modelType: 'bottle-scrubber',
    palette: {
      primary: '#0d9488',
      secondary: '#f1f5f9',
      accent: '#f59e0b',
      base: '#334155',
      details: '#047857'
    }
  },

  // 11. First Tech Challenge Robotics (Sep 2017 - May 2021)
  {
    id: 'first-tech-challenge-robotics',
    title: 'First Tech Challenge Robotics',
    subtitle: 'Robotics Team Mech Lead + Captain',
    date: 'Sep 2017 – May 2021',
    dateRange: 'Sep 2017 – May 2021',
    year: 2021,
    company: 'FIRST Tech Challenge',
    companyLogo: '/ftc-logo.png',
    companyUrl: 'https://www.firstinspires.org/robotics/ftc',
    tags: ['FTC Robotics', 'Mechanism Design', 'CAD', 'Leadership'],
    description: 'Robotics Team Mech Lead + Captain for FIRST Tech Challenge competition team across 4 competitive seasons.',
    extendedDescription: [
      'Led the mechanical design, CAD modeling, precision manufacturing, and competition strategy for 4 generations of FIRST Tech Challenge competition robots.'
    ],
    structuredSections: [
      {
        heading: 'Overview & Seasons Breakdown',
        paragraphs: [
          'As Mechanical Lead and Team Captain, I led mechanical architecture, CAD design in SolidWorks/Inventor, CNC milling, 3D printing, and competition drive team execution across 4 competitive seasons of FIRST Tech Challenge (FTC).'
        ]
      },
      {
        heading: 'Ultimate Goal Season (2020 - 2021)',
        paragraphs: [
          'High-speed disc launcher robot with flywheel accelerator, indexing intake conveyor, and motorized wobble goal gripper.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8941/story-first-tech-challenge-robotics-MIPL.png',
            title: 'Ultimate Goal Robot CAD',
            caption: 'Disc launcher and wobble goal clamp robot CAD'
          }
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=9Ddy6e1VPDw',
            title: 'FTC Match Demonstration - Disc Launcher'
          }
        ]
      },
      {
        heading: 'Skystone Season (2019 - 2020)',
        paragraphs: [
          'Mecanum drive chassis with high-speed compliant intake rollers, vertical virtual-4-bar lift mechanism, and foundation clamping latches.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8941/story-first-tech-challenge-robotics-TrGT.png',
            title: 'Skystone Robot CAD',
            caption: 'Mecanum drive intake and stone stacking lift CAD'
          }
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=IlprMu46Uzo',
            title: 'FTC Match Demonstration - Stone Stacking'
          }
        ]
      },
      {
        heading: 'Rover Ruckus Season (2018 - 2019)',
        paragraphs: [
          'Lander hanging linear rack lift, motorized mineral sweeper intake, and high-angle sorting deposit bucket.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8941/story-first-tech-challenge-robotics-B0yZ.png',
            title: 'Rover Ruckus Robot CAD',
            caption: 'Linear rack lander lift and mineral sorting intake CAD'
          }
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=j09PzmVmzJw',
            title: 'FTC Match Demonstration - Mineral Sorting & Lander Hang'
          }
        ]
      },
      {
        heading: 'Relic Recovery Season (2017 - 2018)',
        paragraphs: [
          'Glyph box manipulator with multi-stage scissor elevator and relic extension arm.'
        ],
        imagesLayout: 'single-centered',
        images: [
          {
            type: 'image',
            url: 'https://chmqmeyyaiwfybqgcdoy.supabase.co/storage/v1/object/public/projects/8941/story-first-tech-challenge-robotics-K2lX.png',
            title: 'Relic Recovery Robot CAD',
            caption: 'Glyph stacking claw and relic recovery arm CAD'
          }
        ],
        media: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=UxK5wK2jlCU',
            title: 'FTC Match Demonstration - Glyph Stacking'
          }
        ]
      }
    ],
    specs: [
      { label: 'Role', value: 'Mechanical Lead + Team Captain (4 Seasons)' },
      { label: 'Drivetrain', value: 'Custom CNC Aluminum Mecanum Drive Base' },
      { label: 'CAD & Simulation', value: 'SolidWorks & Autodesk Inventor' },
      { label: 'Competitions', value: '4 Generations of FTC Regional & State Competitions' }
    ],
    materialsAndManufacturing: [
      'CNC Milled 6061-T6 Aluminum Channel Chassis Plates',
      '3D-Printed PLA / TPU Custom Gears & Pulleys',
      'High-Speed Coreless Servos & Planetary Gearmotors',
      'Laser-Cut Polycarbonate Hopper & Intake Guides'
    ],
    keyChallenges: [
      'Iterative design optimization to fit within strict 18" x 18" x 18" starting sizing box constraints.',
      'Designing fast, high-reliability game piece intake and deposition mechanisms under high-stress match conditions.'
    ],
    modelType: 'ftc-robot',
    palette: {
      primary: '#f59e0b',
      secondary: '#334155',
      accent: '#2563eb',
      base: '#1e293b',
      details: '#94a3b8'
    }
  }
];
