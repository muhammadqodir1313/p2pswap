import {
  Search,
  X,
  SlidersHorizontal,
  Code2,
  Server,
  Database,
  Palette,
  Languages,
  Sparkles,
  ArrowUpDown,
  BookOpen,
  GraduationCap,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterMode = "all" | "teach" | "learn" | "mutual";
export type SortOption = "match" | "skills" | "name";

export const SKILL_CATEGORIES = [
  { id: "all", label: "Barchasi", icon: Sparkles, keywords: [] },
  {
    id: "frontend",
    label: "Frontend & Web",
    icon: Code2,
    keywords: [
      "react",
      "typescript",
      "javascript",
      "html",
      "css",
      "tailwind",
      "next.js",
      "frontend",
      "ui",
    ],
  },
  {
    id: "backend",
    label: "Backend & API",
    icon: Server,
    keywords: [
      "node.js",
      "python",
      "fastapi",
      "docker",
      "backend",
      "express",
      "api",
      "golang",
      "java",
    ],
  },
  {
    id: "database",
    label: "Ma’lumotlar bazasi",
    icon: Database,
    keywords: ["sql", "postgresql", "join", "pandas", "database", "mongodb", "baza"],
  },
  {
    id: "design",
    label: "UI/UX & Dizayn",
    icon: Palette,
    keywords: ["figma", "dizayn", "ui", "ux", "design", "illustrator"],
  },
  {
    id: "languages",
    label: "Chet tillari",
    icon: Languages,
    keywords: ["ingliz", "english", "speaking", "til", "rus", "nemis"],
  },
] as const;

export const POPULAR_TAGS = [
  "React",
  "Python",
  "SQL JOIN",
  "Node.js",
  "TypeScript",
  "Figma",
  "Ingliz tili",
  "Tailwind CSS",
  "Docker",
  "PostgreSQL",
];

type SkillSearchFilterProps = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  totalResults: number;
  onResetFilters: () => void;
};

export function SkillSearchFilter({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  filterMode,
  onFilterModeChange,
  sortBy,
  onSortByChange,
  totalResults,
  onResetFilters,
}: SkillSearchFilterProps) {
  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedCategory !== "all" || filterMode !== "all";

  return (
    <div className="surface-card p-4 sm:p-5 space-y-4">
      {/* Search Input & Sort Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search input with icon and clear button */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Ko‘nikma, texnologiya yoki mavzu qidiring (masalan: React, Python, SQL)…"
            className="pl-10 pr-9 h-11 bg-background text-sm rounded-xl"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              title="Tozalash"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Sort select */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-[180px] sm:w-[200px]">
            <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SortOption)}>
              <SelectTrigger className="h-11 rounded-xl bg-background text-xs sm:text-sm">
                <div className="flex items-center gap-2 truncate">
                  <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Tartiblash" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="match">Moslik darajasi</SelectItem>
                <SelectItem value="skills">Ko‘nikmalar soni</SelectItem>
                <SelectItem value="name">Ism bo‘yicha (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <SlidersHorizontal className="size-3 text-accent" />
          Kategoriyalar bo‘yicha filtrlash:
        </p>
        <div className="flex flex-wrap gap-2">
          {SKILL_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary"
                    : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Mode (All, Teaching, Learning, Mutual) & Popular Tags */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60 pt-3">
        {/* Scope Mode Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Qidiruv sohasi:</span>
          <button
            type="button"
            onClick={() => onFilterModeChange("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filterMode === "all"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Barchasi
          </button>
          <button
            type="button"
            onClick={() => onFilterModeChange("teach")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filterMode === "teach"
                ? "bg-emerald-600 text-white"
                : "bg-secondary text-muted-foreground hover:text-emerald-400"
            }`}
          >
            <GraduationCap className="size-3" />
            O‘rgatuvchilar
          </button>
          <button
            type="button"
            onClick={() => onFilterModeChange("learn")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filterMode === "learn"
                ? "bg-sky-600 text-white"
                : "bg-secondary text-muted-foreground hover:text-sky-400"
            }`}
          >
            <BookOpen className="size-3" />
            O‘rganuvchilar
          </button>
          <button
            type="button"
            onClick={() => onFilterModeChange("mutual")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filterMode === "mutual"
                ? "bg-accent text-accent-foreground font-semibold"
                : "bg-secondary text-muted-foreground hover:text-accent"
            }`}
          >
            <Sparkles className="size-3" />
            O‘zaro moslar
          </button>
        </div>

        {/* Results summary and Reset */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">
            <span className="text-foreground font-semibold">{totalResults}</span> ta a’zo topildi
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-7 px-2 text-xs text-accent hover:text-accent/80 hover:bg-accent/10"
            >
              Filtrlarni tozalash
            </Button>
          )}
        </div>
      </div>

      {/* Popular Quick-Select Tags */}
      <div className="border-t border-border/40 pt-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[11px] text-muted-foreground shrink-0">Ommabop:</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {POPULAR_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onSearchChange(searchQuery === tag ? "" : tag)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                searchQuery.toLowerCase() === tag.toLowerCase()
                  ? "bg-accent/30 text-accent font-semibold border border-accent/40"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/30"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
