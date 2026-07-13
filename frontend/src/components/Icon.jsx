/* Icono basado en lucide-react + marcas de NodeKeeper (Logo / Mark).
   El kit usa nombres kebab ('layout-dashboard'); aquí los mapeamos a los
   componentes de lucide-react (import explícito → tree-shakeable). El wrapper
   .ic permite que el color del nav activo cascadee al trazo del SVG. */
import {
  LayoutDashboard, Share2, Server, Wrench, CalendarDays, Map as MapIcon, Image as ImageIcon,
  BarChart3, Users, Settings, Menu, Search, Plus, Bell, LogOut, Download, Repeat, Lock,
  CheckCircle2, Paperclip, Check, UploadCloud, FileText, ArrowLeft, ArrowRight, MapPin, Pencil,
  ChevronRight, ChevronLeft, SlidersHorizontal, List, Eye, Printer, UserPlus, MoreHorizontal,
  HardHat, Shield, AlertCircle, SearchX, Circle, Building2, Phone, Mail, X, Trash2, ExternalLink,
} from 'lucide-react';

const ICONS = {
  'layout-dashboard': LayoutDashboard, 'share-2': Share2, server: Server, wrench: Wrench,
  'calendar-days': CalendarDays, map: MapIcon, image: ImageIcon, 'bar-chart-3': BarChart3,
  users: Users, settings: Settings, menu: Menu, search: Search, plus: Plus, bell: Bell,
  'log-out': LogOut, download: Download, repeat: Repeat, lock: Lock, 'check-circle-2': CheckCircle2,
  paperclip: Paperclip, check: Check, 'upload-cloud': UploadCloud, 'file-text': FileText,
  'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'map-pin': MapPin, pencil: Pencil,
  'chevron-right': ChevronRight, 'chevron-left': ChevronLeft, 'sliders-horizontal': SlidersHorizontal,
  list: List, eye: Eye, printer: Printer, 'user-plus': UserPlus, 'more-horizontal': MoreHorizontal,
  'hard-hat': HardHat, shield: Shield, 'alert-circle': AlertCircle, 'search-x': SearchX,
  'building-2': Building2, phone: Phone, mail: Mail, x: X, 'trash-2': Trash2, 'external-link': ExternalLink,
};

export function Icon({ name, size = 18, stroke = 2, style, className = '' }) {
  const Cmp = ICONS[name] || Circle;
  return (
    <span className={`ic ${className}`} style={style}>
      <Cmp size={size} strokeWidth={stroke} />
    </span>
  );
}

export function Mark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NodeKeeper" style={{ display: 'block' }}>
      <rect width="44" height="44" rx="10" fill="#0F2440" />
      <rect x="0.5" y="0.5" width="43" height="43" rx="9.5" stroke="#FFFFFF" strokeOpacity="0.06" />
      <g stroke="#3B7DE0" strokeWidth="2" strokeLinecap="round">
        <line x1="22" y1="22" x2="13" y2="13" /><line x1="22" y1="22" x2="31" y2="13" />
        <line x1="22" y1="22" x2="13" y2="31" /><line x1="22" y1="22" x2="31" y2="31" />
      </g>
      <circle cx="13" cy="13" r="3.4" fill="#2563C9" /><circle cx="31" cy="13" r="3.4" fill="#2563C9" />
      <circle cx="13" cy="31" r="3.4" fill="#2563C9" /><circle cx="31" cy="31" r="3.4" fill="#22A862" />
      <circle cx="22" cy="22" r="5.2" fill="#FFFFFF" /><circle cx="22" cy="22" r="2.2" fill="#0F2440" />
    </svg>
  );
}

export function Logo({ height = 28, variant = 'dark' }) {
  const dark = variant === 'dark';
  return (
    <svg height={height} width={height * (208 / 44)} viewBox="0 0 208 44" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NodeKeeper" style={{ display: 'block' }}>
      <rect width="44" height="44" rx="10" fill={dark ? '#FFFFFF' : '#0F2440'} fillOpacity={dark ? 0.06 : 1} />
      {dark && <rect x="0.5" y="0.5" width="43" height="43" rx="9.5" stroke="#FFFFFF" strokeOpacity="0.12" />}
      <g stroke="#3B7DE0" strokeWidth="2" strokeLinecap="round">
        <line x1="22" y1="22" x2="13" y2="13" /><line x1="22" y1="22" x2="31" y2="13" />
        <line x1="22" y1="22" x2="13" y2="31" /><line x1="22" y1="22" x2="31" y2="31" />
      </g>
      <circle cx="13" cy="13" r="3.4" fill={dark ? '#6BA0EC' : '#2563C9'} /><circle cx="31" cy="13" r="3.4" fill={dark ? '#6BA0EC' : '#2563C9'} />
      <circle cx="13" cy="31" r="3.4" fill={dark ? '#6BA0EC' : '#2563C9'} /><circle cx="31" cy="31" r="3.4" fill="#22A862" />
      <circle cx="22" cy="22" r="5.2" fill="#FFFFFF" /><circle cx="22" cy="22" r="2.2" fill="#0F2440" />
      <text x="56" y="29" fontFamily="'Nunito', sans-serif" fontSize="22" fontWeight="700" letterSpacing="-0.01em" fill={dark ? '#FFFFFF' : '#0F2440'}>Node<tspan fill={dark ? '#6BA0EC' : '#2563C9'}>Keeper</tspan></text>
    </svg>
  );
}
