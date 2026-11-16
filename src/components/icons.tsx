/**
 * App icon set.
 *
 * CipherSuite uses Phosphor Icons (MIT, https://phosphoricons.com). Every
 * icon the app needs is exported here under one stable name, so screens
 * import from "@/components/icons" and the icon library can change in one
 * place.
 *
 * Defaults: 24px (override with Tailwind w-/h- classes) and the "regular"
 * weight. Pass weight="fill" or weight="duotone" to show state, for example
 * the active item in the sidebar.
 */
import * as React from "react";
import type { Icon as PhosphorIcon, IconProps } from "@phosphor-icons/react";
import {
  Archive as PhArchive,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsIn,
  ArrowsOut,
  Bell as PhBell,
  BracketsCurly,
  Bug as PhBug,
  Buildings,
  CalendarBlank,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChartBar,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  CheckSquare as PhCheckSquare,
  Checks,
  Circle as PhCircle,
  CircleNotch,
  ClipboardText,
  Clock as PhClock,
  Code as PhCode,
  Columns,
  Copy as PhCopy,
  Crosshair,
  DownloadSimple,
  Eye as PhEye,
  EyeSlash,
  FileArrowDown,
  FileCode as PhFileCode,
  FileImage as PhFileImage,
  FileMagnifyingGlass,
  FileText as PhFileText,
  FileZip,
  FloppyDisk,
  FolderOpen as PhFolderOpen,
  Funnel,
  GearSix,
  Globe as PhGlobe,
  Hash as PhHash,
  Image as PhImage,
  Info as PhInfo,
  Layout,
  Lightning,
  Link as PhLink,
  LinkSimple,
  List as PhList,
  ListNumbers,
  Lock as PhLock,
  MagnifyingGlass,
  Minus as PhMinus,
  Note,
  Notebook,
  Paperclip as PhPaperclip,
  PencilSimple,
  Plus as PhPlus,
  Pulse,
  Quotes,
  Shield as PhShield,
  ShieldCheck as PhShieldCheck,
  ShieldWarning,
  Sidebar,
  SignOut,
  SlidersHorizontal as PhSlidersHorizontal,
  SortAscending,
  SortDescending,
  Sparkle,
  Square as PhSquare,
  SquaresFour,
  Stack,
  Terminal as PhTerminal,
  TerminalWindow,
  TextB,
  TextHThree,
  TextHTwo,
  TextItalic,
  Trash,
  TrendUp,
  UploadSimple,
  Warning,
  WarningCircle,
  X as PhX,
  XCircle as PhXCircle,
} from "@phosphor-icons/react/dist/ssr";

export type AppIcon = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;

function icon(Base: PhosphorIcon, name: string): AppIcon {
  const Wrapped = React.forwardRef<SVGSVGElement, IconProps>(function AppIcon(
    { size = 24, weight = "regular", ...props },
    ref,
  ) {
    return <Base ref={ref} size={size} weight={weight} aria-hidden="true" {...props} />;
  });
  Wrapped.displayName = name;
  return Wrapped;
}

// Navigation and layout
export const LayoutDashboard = icon(SquaresFour, "LayoutDashboard");
export const LayoutGrid      = icon(SquaresFour, "LayoutGrid");
export const Grid3x3         = icon(SquaresFour, "Grid3x3");
export const LayoutTemplate  = icon(Layout, "LayoutTemplate");
export const PanelLeft       = icon(Sidebar, "PanelLeft");
export const List            = icon(PhList, "List");
export const ListOrdered     = icon(ListNumbers, "ListOrdered");
export const Settings        = icon(GearSix, "Settings");
export const Bell            = icon(PhBell, "Bell");
export const LogOut          = icon(SignOut, "LogOut");
export const Search          = icon(MagnifyingGlass, "Search");
export const Filter          = icon(Funnel, "Filter");
export const SlidersHorizontal = icon(PhSlidersHorizontal, "SlidersHorizontal");
export const SortAsc         = icon(SortAscending, "SortAsc");
export const SortDesc        = icon(SortDescending, "SortDesc");

// Arrows and carets
export const ArrowLeft       = icon(PhArrowLeft, "ArrowLeft");
export const ArrowRight      = icon(PhArrowRight, "ArrowRight");
export const ChevronDown     = icon(CaretDown, "ChevronDown");
export const ChevronUp       = icon(CaretUp, "ChevronUp");
export const ChevronLeft     = icon(CaretLeft, "ChevronLeft");
export const ChevronRight    = icon(CaretRight, "ChevronRight");
export const ChevronsLeft    = icon(CaretDoubleLeft, "ChevronsLeft");
export const ChevronsRight   = icon(CaretDoubleRight, "ChevronsRight");
export const ExternalLink    = icon(ArrowSquareOut, "ExternalLink");
export const Maximize2       = icon(ArrowsOut, "Maximize2");
export const Minimize2       = icon(ArrowsIn, "Minimize2");
export const TrendingUp      = icon(TrendUp, "TrendingUp");
export const RefreshCw       = icon(ArrowsClockwise, "RefreshCw");

// Security domain
export const Shield          = icon(PhShield, "Shield");
export const ShieldAlert     = icon(ShieldWarning, "ShieldAlert");
export const ShieldCheck     = icon(PhShieldCheck, "ShieldCheck");
export const Bug             = icon(PhBug, "Bug");
export const Target          = icon(Crosshair, "Target");
export const Lock            = icon(PhLock, "Lock");
export const Terminal        = icon(PhTerminal, "Terminal");
export const FileTerminal    = icon(TerminalWindow, "FileTerminal");
export const Activity        = icon(Pulse, "Activity");
export const Zap             = icon(Lightning, "Zap");
export const Sparkles        = icon(Sparkle, "Sparkles");

// Status and feedback
export const AlertTriangle   = icon(Warning, "AlertTriangle");
export const AlertCircle     = icon(WarningCircle, "AlertCircle");
export const Info            = icon(PhInfo, "Info");
export const Check           = icon(PhCheck, "Check");
export const CheckCheck      = icon(Checks, "CheckCheck");
export const CheckCircle     = icon(PhCheckCircle, "CheckCircle");
export const CheckCircle2    = icon(PhCheckCircle, "CheckCircle2");
export const CheckSquare     = icon(PhCheckSquare, "CheckSquare");
export const Square          = icon(PhSquare, "Square");
export const Circle          = icon(PhCircle, "Circle");
export const XCircle         = icon(PhXCircle, "XCircle");
export const X               = icon(PhX, "X");
export const Loader2         = icon(CircleNotch, "Loader2");
export const Clock           = icon(PhClock, "Clock");
export const Calendar        = icon(CalendarBlank, "Calendar");

// Files, evidence and reports
export const FileText        = icon(PhFileText, "FileText");
export const FileCode        = icon(PhFileCode, "FileCode");
export const FileJson        = icon(BracketsCurly, "FileJson");
export const FileImage       = icon(PhFileImage, "FileImage");
export const FileArchive     = icon(FileZip, "FileArchive");
export const FileSearch      = icon(FileMagnifyingGlass, "FileSearch");
export const FileDown        = icon(FileArrowDown, "FileDown");
export const FileBarChart2   = icon(ClipboardText, "FileBarChart2");
export const Image           = icon(PhImage, "Image");
export const Archive         = icon(PhArchive, "Archive");
export const FolderOpen      = icon(PhFolderOpen, "FolderOpen");
export const Paperclip       = icon(PhPaperclip, "Paperclip");
export const Upload          = icon(UploadSimple, "Upload");
export const HardDriveUpload = icon(UploadSimple, "HardDriveUpload");
export const Download        = icon(DownloadSimple, "Download");
export const Save            = icon(FloppyDisk, "Save");
export const Copy            = icon(PhCopy, "Copy");
export const Trash2          = icon(Trash, "Trash2");
export const Pencil          = icon(PencilSimple, "Pencil");
export const Plus            = icon(PhPlus, "Plus");
export const Minus           = icon(PhMinus, "Minus");
export const Eye             = icon(PhEye, "Eye");
export const EyeOff          = icon(EyeSlash, "EyeOff");
export const Link            = icon(PhLink, "Link");
export const Link2           = icon(LinkSimple, "Link2");
export const Hash            = icon(PhHash, "Hash");
export const Globe           = icon(PhGlobe, "Globe");
export const Building2       = icon(Buildings, "Building2");
export const StickyNote      = icon(Note, "StickyNote");
export const BookText        = icon(Notebook, "BookText");
export const Layers          = icon(Stack, "Layers");

// Charts
export const BarChart        = icon(ChartBar, "BarChart");
export const BarChart2       = icon(ChartBar, "BarChart2");
export const BarChart3       = icon(ChartBar, "BarChart3");

// Editor toolbar
export const Bold            = icon(TextB, "Bold");
export const Italic          = icon(TextItalic, "Italic");
export const Heading2        = icon(TextHTwo, "Heading2");
export const Heading3        = icon(TextHThree, "Heading3");
export const Quote           = icon(Quotes, "Quote");
export const Code            = icon(PhCode, "Code");
export const Code2           = icon(Columns, "Code2");
