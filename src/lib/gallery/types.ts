export type GalleryKind = 'artwork' | 'template';
export type GallerySort = 'popular' | 'newest';
export type VoteType = 'heart' | 'like';

export interface GalleryItem {
  id: string;
  url: string;
  prompt: string;
  author: string;
  kind: GalleryKind;
  /** For ferdige kunstverk: malen (strektegningen) det er laget fra. */
  templateId?: string;
  templateUrl?: string;
  status: 'pending' | 'approved';
  createdAt: number;
  hearts: number;
  likes: number;
  /** Hvor mange ganger malen er hentet for å fargelegges. */
  uses: number;
}

export interface GalleryPage {
  enabled: boolean;
  items: GalleryItem[];
  total: number;
  page: number;
  totalPages: number;
  myVotes: Record<string, VoteType>;
}
