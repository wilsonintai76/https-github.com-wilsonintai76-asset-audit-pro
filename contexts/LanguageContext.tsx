
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale } from '../types';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Nav Labels
    'nav.overview': 'Overview',
    'nav.inspection_schedule': 'Inspection Schedule',
    'nav.inspecting_officer_dashboard': 'Inspecting Officer Dashboard',
    'nav.team_management': 'Team Management',
    'nav.departments': 'Departments',
    'nav.asset_locations': 'Asset Locations',
    'nav.system_settings': 'System Settings',
    'nav.profile': 'My Profile',
    'nav.logout': 'Logout',
    
    // MOF Terms
    'term.inspection_schedule': 'Movable Asset Inspection Schedule',
    'term.inspection': 'Movable Asset Inspection',
    'term.inspection_report': 'Movable Asset Inspection Report',
    'term.inspecting_officer': 'Inspecting Officer',
    'term.head_of_department': 'Head of Department',
    'term.asset_location': 'Asset Location',
    
    // UI Elements
    'ui.main_menu': 'Main Menu',
    'ui.administration': 'Administration',
    'ui.database_connection': 'Database Connection',
    'ui.cloud_instance': 'Cloud Instance',
    'ui.language': 'Language',
    
    // Dashboard Specific
    'dashboard.title': 'Institutional Inspection Dashboard',
    'dashboard.subtitle': 'Real-time performance and compliance tracking across all departments.',
    'dashboard.stats_inspections': 'Total Inspections',
    'dashboard.stats_completed': 'Completed',
    'dashboard.stats_pending': 'Pending',
    'dashboard.stats_open_slots': 'Open Slots',
    'dashboard.stats_on_track': 'On Track',
    'dashboard.stats_assets': 'Assets Inspected',
    'dashboard.upcoming': 'Upcoming Inspections',
    'dashboard.no_upcoming': 'No upcoming inspections scheduled',
    'dashboard.velocity': 'Inspection Velocity',
    'dashboard.compliance': 'Performance',
    'dashboard.performance': 'Institutional Inspection Performance',
    'dashboard.progress': 'Institutional Inspection Progress',
    'dashboard.overall_completion': 'Overall Completion',
    'dashboard.global_goal': 'Global Goal',
    'dashboard.status': 'Status',
    'dashboard.on_track': 'On Track',
    'dashboard.at_risk': 'At Risk',
    'dashboard.tier_progress': 'Department Tier Progress',
    'dashboard.dept_breakdown': 'Department Breakdown',
    'dashboard.current_phase': 'Current Phase',
    'dashboard.phase_ends': 'Phase Ends'
  },
  ms: {
    // Nav Labels
    'nav.overview': 'Gambaran Keseluruhan',
    'nav.inspection_schedule': 'Jadual Pemeriksaan',
    'nav.inspecting_officer_dashboard': 'Papan Pemuka Pegawai Pemeriksa',
    'nav.team_management': 'Pengurusan Pasukan',
    'nav.departments': 'Jabatan',
    'nav.asset_locations': 'Lokasi Aset',
    'nav.system_settings': 'Tetapan Sistem',
    'nav.profile': 'Profil Saya',
    'nav.logout': 'Log Keluar',
    
    // MOF Terms
    'term.inspection_schedule': 'Jadual Pemeriksaan Aset Alih',
    'term.inspection': 'Pemeriksaan Aset Alih',
    'term.inspection_report': 'Laporan Pemeriksaan Aset Alih',
    'term.inspecting_officer': 'Pegawai Pemeriksa',
    'term.head_of_department': 'Ketua Jabatan',
    'term.asset_location': 'Lokasi Aset',
    
    // UI Elements
    'ui.main_menu': 'Menu Utama',
    'ui.administration': 'Pentadbiran',
    'ui.database_connection': 'Sambungan Pangkalan Data',
    'ui.cloud_instance': 'Instansi Awan',
    'ui.language': 'Bahasa',
    
    // Dashboard Specific
    'dashboard.title': 'Papan Pemuka Pemeriksaan Institusi',
    'dashboard.subtitle': 'Prestasi masa nyata dan pemantauan pematuhan semua jabatan.',
    'dashboard.stats_inspections': 'Jumlah Pemeriksaan',
    'dashboard.stats_completed': 'Selesai',
    'dashboard.stats_pending': 'Belum Selesai',
    'dashboard.stats_open_slots': 'Slot Terbuka',
    'dashboard.stats_on_track': 'Menepati Masa',
    'dashboard.stats_assets': 'Aset Diperiksa',
    'dashboard.upcoming': 'Pemeriksaan Akan Datang',
    'dashboard.no_upcoming': 'Tiada pemeriksaan akan datang dijadualkan',
    'dashboard.velocity': 'Kelajuan Pemeriksaan',
    'dashboard.compliance': 'Prestasi',
    'dashboard.performance': 'Prestasi Pemeriksaan Institusi',
    'dashboard.progress': 'Kemajuan Pemeriksaan Institusi',
    'dashboard.overall_completion': 'Keseluruhan Selesai',
    'dashboard.global_goal': 'Matlamat Global',
    'dashboard.status': 'Status',
    'dashboard.on_track': 'Menepati Masa',
    'dashboard.at_risk': 'Berisiko',
    'dashboard.tier_progress': 'Kemajuan Tahap Jabatan',
    'dashboard.dept_breakdown': 'Pecahan Jabatan',
    'dashboard.current_phase': 'Fasa Semasa',
    'dashboard.phase_ends': 'Fasa Berakhir'
  }
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('inspectable_locale');
    return (saved === 'en' || saved === 'ms') ? saved : 'en';
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('inspectable_locale', newLocale);
  };

  const t = (key: string): string => {
    return translations[locale][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
