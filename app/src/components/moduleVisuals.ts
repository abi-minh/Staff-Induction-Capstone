import type { SvgIconComponent } from '@mui/icons-material';
import { getIconByKey }          from './iconLibrary';
import type { Module }           from '../types';

export function getModuleIcon(module: Module): SvgIconComponent {
  return getIconByKey(module.meta.module_icon);
}

export function getModuleHero(module: Module): string {
  return module.heroImageUrl ?? '';
}
