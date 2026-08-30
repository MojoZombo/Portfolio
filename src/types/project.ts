export interface ProjectSpec {
  label: string;
  value: string;
}

export interface MediaItem {
  type: 'image' | 'youtube' | 'video';
  url: string;
  caption?: string;
  title?: string;
}

export interface SubSection {
  title: string;
  content: string;
  image?: string;
  imageCaption?: string;
}

export interface StructuredSection {
  heading: string;
  paragraphs?: string[];
  subSections?: SubSection[];
  imagesLayout?: 'grid-2-1' | 'grid-2' | 'single-centered' | 'carousel' | 'grid-1-2';
  images?: MediaItem[];
  carouselImages?: MediaItem[];
  media?: MediaItem[];
}

export interface AnimationTranslation {
  /** Horizontal translation distance for 3D model on desktop (default: 160px, positive = right, negative = left) */
  modelX?: number;
  /** Horizontal translation distance for text card on desktop (default: -24px, negative = left, positive = right) */
  textX?: number;
  /** Vertical translation distance for 3D model (default: 0px) */
  modelY?: number;
  /** Vertical translation distance for text card (default: 0px) */
  textY?: number;
}

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  dateRange?: string;
  year: number;
  tags: string[];
  company?: string;
  companyLogo?: string;
  companyUrl?: string;
  description: string;
  extendedDescription: string[];
  projectWebsiteUrl?: string;
  structuredSections?: StructuredSection[];
  mediaGallery?: MediaItem[];
  specs?: ProjectSpec[];
  materialsAndManufacturing?: string[];
  keyChallenges?: string[];
  showspaceUrl?: string;
  modelType:
    | 'tesla-actuator'
    | 'inductive-robot'
    | 'robot-hand'
    | 'cable-robot-2'
    | 'ping-pong'
    | 'catamaran'
    | 'drone-catch'
    | 'outrigger'
    | 'modular-gripper'
    | 'underwater-robot'
    | 'anti-tangle-winch'
    | 'bottle-scrubber'
    | 'ftc-robot';
  palette?: {
    primary: string;
    secondary: string;
    accent: string;
    base: string;
    details: string;
  };
  /** Custom translation distances for desktop animations in both directions */
  animationTranslation?: AnimationTranslation;
  /** Direct shorthand for model horizontal translation distance */
  modelTranslateX?: number;
  /** Direct shorthand for text card horizontal translation distance */
  textTranslateX?: number;
  /** Direct shorthand for model vertical translation distance */
  modelTranslateY?: number;
  /** Direct shorthand for text card vertical translation distance */
  textTranslateY?: number;
}
