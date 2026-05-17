import {
  Boxes,
  FileText,
  House,
  Link2,
  type LucideIcon,
  Settings2,
} from "lucide-react";

export type NavKey =
  | "home"
  | "fragments"
  | "timeline"
  | "relations"
  | "settings";

export type NavItem = {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  eyebrow: string;
  blurb: string;
  accent: string;
};

export const allPages: NavItem[] = [
  {
    key: "home",
    label: "首页",
    icon: House,
    eyebrow: "起点",
    blurb: "Fragment Isles 的总览首页，用来进入不同工作岛，保持整体结构和节奏感。",
    accent: "from-[#556D41]/30 via-[#7A5636]/14 to-transparent",
  },
  {
    key: "fragments",
    label: "Fragments 碎片",
    icon: Boxes,
    eyebrow: "收集",
    blurb: "用于放置笔记、摘录、链接、代码片段与科研灵感的安静入口，像林间散落却可抵达的小岛。",
    accent: "from-[#6D8A58]/28 via-[#A67C52]/14 to-transparent",
  },
  {
    key: "timeline",
    label: "Timeline 时间轴",
    icon: FileText,
    eyebrow: "时间",
    blurb: "承接 deadline、提醒与时间线索的收件箱，让时间信息像林中路径一样清晰浮现。",
    accent: "from-[#8A9A5B]/26 via-[#C49A6C]/14 to-transparent",
  },
  {
    key: "relations",
    label: "Relations 关系",
    icon: Link2,
    eyebrow: "连接",
    blurb: "未来用于整理支撑、冲突、重复与延展关系的地图，让想法之间出现真正可见的桥梁。",
    accent: "from-[#5E7A4D]/28 via-[#8B5E3C]/12 to-transparent",
  },
  {
    key: "settings",
    label: "Settings 设置",
    icon: Settings2,
    eyebrow: "控制",
    blurb: "用于承接 API Provider、成本可见性与应用偏好的占位区域，当前只保留入口与结构。",
    accent: "from-[#7E8E62]/22 via-[#8F6747]/12 to-transparent",
  },
];

export const sidebarPages = allPages.filter((item) => item.key !== "home");
