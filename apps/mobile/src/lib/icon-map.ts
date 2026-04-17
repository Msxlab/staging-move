import {
  Mail,
  School,
  Stethoscope,
  Package,
  PawPrint,
  Zap,
  Droplets,
  Flame,
  Globe,
  Home,
  Plug,
  Receipt,
  Earth,
  Landmark,
  Building2,
  CreditCard,
  Car,
  Heart,
  Key,
  DollarSign,
  Shield,
  Waves,
  Truck,
  Wrench,
  Lock,
  UserRound,
  Baby,
  Palette,
  Dumbbell,
  ShoppingCart,
  Pill,
  Smartphone,
  Tv,
  Trash2,
  Scale,
  Bus,
  CircleParking,
  Dog,
  GraduationCap,
  Hospital,
  Vote,
  IdCard,
  Siren,
  Building,
  TreePine,
  Bug,
  SprayCan,
  type LucideIcon,
  ClipboardList,
  MapPin,
  Briefcase,
  Star,
  Bike,
  Sailboat,
  Caravan,
  CircleDot,
  CircleAlert,
  Circle,
  FileText,
} from "lucide-react-native";

const EMOJI_ICON_MAP: Record<string, LucideIcon> = {
  // Checklist phases
  "\u{1F4E6}": Package,       // 📦
  "\u{1F69A}": Truck,         // 🚚
  "\u26A1": Zap,              // ⚡
  "\u{1F4CB}": ClipboardList, // 📋
  "\u{1F527}": Wrench,        // 🔧
  "\u{1F3E0}": Home,          // 🏠

  // Checklist items
  "\u{1F4EC}": Mail,          // 📬
  "\u{1F3EB}": School,        // 🏫
  "\u{1FA7A}": Stethoscope,   // 🩺
  "\u{1F43E}": PawPrint,      // 🐾
  "\u{1F4A7}": Droplets,      // 💧
  "\u{1F525}": Flame,         // 🔥
  "\u{1F310}": Globe,         // 🌐
  "\u{1F50C}": Plug,          // 🔌
  "\u{1F9FE}": Receipt,       // 🧾
  "\u{1F30D}": Earth,         // 🌍
  "\u{1F3DB}\uFE0F": Landmark,// 🏛️
  "\u{1F3DB}": Landmark,      // 🏛 (without variation selector)
  "\u{1F3E6}": Building2,     // 🏦
  "\u{1F4B3}": CreditCard,    // 💳
  "\u{1F697}": Car,           // 🚗
  "\u{1F3E5}": Hospital,      // 🏥
  "\u{1F511}": Key,           // 🔑
  "\u{1F4B0}": DollarSign,    // 💰
  "\u{1F6E1}\uFE0F": Shield,  // 🛡️
  "\u{1F6E1}": Shield,        // 🛡
  "\u{1F30A}": Waves,         // 🌊
  "\u{1F3D8}\uFE0F": Building,// 🏘️
  "\u{1F3D8}": Building,      // 🏘
  "\u{1F3E1}": Home,          // 🏡
  "\u{1F512}": Lock,          // 🔒
  "\u{1F9B7}": UserRound,     // 🦷 (dentist → user)
  "\u{1F48A}": Pill,          // 💊
  "\u{1F474}": UserRound,     // 👴
  "\u{1F6E3}\uFE0F": Car,     // 🛣️
  "\u{1F6E3}": Car,           // 🛣
  "\u{1F68C}": Bus,           // 🚌
  "\u{1F17F}\uFE0F": CircleParking, // 🅿️
  "\u{1F17F}": CircleParking, // 🅿
  "\u{1F476}": Baby,          // 👶
  "\u{1F3A8}": Palette,       // 🎨
  "\u{1F4AA}": Dumbbell,      // 💪
  "\u{1F9D8}": Dumbbell,      // 🧘
  "\u{1F6D2}": ShoppingCart,  // 🛒
  "\u{1F4F1}": Smartphone,    // 📱
  "\u{1F4FA}": Tv,            // 📺
  "\u{1F5D1}\uFE0F": Trash2,  // 🗑️
  "\u{1F5D1}": Trash2,        // 🗑
  "\u{1F6B0}": Droplets,      // 🚰
  "\u{2696}\uFE0F": Scale,    // ⚖️
  "\u{2696}": Scale,          // ⚖
  "\u{1F415}": Dog,           // 🐕
  "\u{1F393}": GraduationCap, // 🎓
  "\u{1F5F3}\uFE0F": Vote,    // 🗳️
  "\u{1F5F3}": Vote,          // 🗳
  "\u{1FAAA}": IdCard,        // 🪪
  "\u{1F6A8}": Siren,         // 🚨
  "\u{1F3E2}": Building,      // 🏢
  "\u{1F33F}": TreePine,      // 🌿
  "\u{1F41B}": Bug,           // 🐛
  "\u{1F9F9}": SprayCan,      // 🧹
  "\u{1F3CD}\uFE0F": Bike,    // 🏍️
  "\u{1F3CD}": Bike,          // 🏍
  "\u26F5": Sailboat,         // ⛵
  "\u{1F690}": Caravan,       // 🚐
  "\u{1F695}": Car,           // 🚕

  // Urgency tiers
  "\u{1F534}": CircleAlert,   // 🔴
  "\u{1F7E0}": CircleDot,     // 🟠
  "\u{1F7E1}": CircleDot,     // 🟡
  "\u26AA": Circle,           // ⚪

  // Misc
  "\u23F1": FileText,         // ⏱
};

export function getIconForEmoji(emoji: string): LucideIcon | null {
  if (!emoji) return null;
  return EMOJI_ICON_MAP[emoji] || null;
}

export function getIconOrFallback(emoji: string, fallback: LucideIcon = ClipboardList): LucideIcon {
  return EMOJI_ICON_MAP[emoji] || fallback;
}
