export interface NovelItem {
  id: string;
  title: string;
  author?: string;
  platform?: string;
  url?: string;
  intro: string;
  tags?: string[];
  category?: string;
  status?: string;
  wordCount?: string;
  updateTime?: string;
  summary?: string;
  plotKeywords?: string[];
  characterTags?: string[];
  genreTags?: string[];
  embedding?: number[];
  source: "import" | "manual" | "web";
  createdAt: number;
  updatedAt: number;
}
