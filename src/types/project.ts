export interface ProjectSpec {
  label: string;
  value: string;
}

export interface MediaItem {
  type: 'image' | 'youtube';
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
  description: string;
  extendedDescription: string[];
  projectWebsiteUrl?: string;
  structuredSections?: StructuredSection[];
  mediaGallery?: MediaItem[];
  specs: ProjectSpec[];
  materialsAndManufacturing: string[];
  keyChallenges: string[];
  showspaceUrl?: string;
  modelType: 'robot-hand' | 'cable-robot-2' | 'ping-pong' | 'catamaran' | 'drone-catch' | 'outrigger' | 'modular-gripper' | 'underwater-robot' | 'anti-tangle-winch' | 'bottle-scrubber' | 'ftc-robot';
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    base: string;
    details: string;
  };
}
