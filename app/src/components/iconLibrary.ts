import type { SvgIconComponent }   from '@mui/icons-material';
import VerifiedUserOutlined        from '@mui/icons-material/VerifiedUserOutlined';
import WarningAmberOutlined        from '@mui/icons-material/WarningAmberOutlined';
import HealthAndSafetyOutlined     from '@mui/icons-material/HealthAndSafetyOutlined';
import MedicalServicesOutlined     from '@mui/icons-material/MedicalServicesOutlined';
import LocalHospitalOutlined       from '@mui/icons-material/LocalHospitalOutlined';
import PhishingOutlined            from '@mui/icons-material/PhishingOutlined';
import SetMealOutlined             from '@mui/icons-material/SetMealOutlined';
import DirectionsBoatOutlined      from '@mui/icons-material/DirectionsBoatOutlined';
import SailingOutlined             from '@mui/icons-material/SailingOutlined';
import AnchorOutlined              from '@mui/icons-material/AnchorOutlined';
import WavesOutlined               from '@mui/icons-material/WavesOutlined';
import WindowOutlined              from '@mui/icons-material/WindowOutlined';
import GridViewOutlined            from '@mui/icons-material/GridViewOutlined';
import ShareOutlined               from '@mui/icons-material/ShareOutlined';
import LinkOutlined                from '@mui/icons-material/LinkOutlined';
import BuildOutlined               from '@mui/icons-material/BuildOutlined';
import HandymanOutlined            from '@mui/icons-material/HandymanOutlined';
import SpaOutlined                 from '@mui/icons-material/SpaOutlined';
import PublicOutlined              from '@mui/icons-material/PublicOutlined';
import GroupsOutlined              from '@mui/icons-material/GroupsOutlined';
import SupportAgentOutlined        from '@mui/icons-material/SupportAgentOutlined';
import GavelOutlined               from '@mui/icons-material/GavelOutlined';
import PolicyOutlined              from '@mui/icons-material/PolicyOutlined';
import PlaceOutlined               from '@mui/icons-material/PlaceOutlined';
import RestaurantOutlined          from '@mui/icons-material/RestaurantOutlined';
import CleaningServicesOutlined    from '@mui/icons-material/CleaningServicesOutlined';
import AssignmentOutlined          from '@mui/icons-material/AssignmentOutlined';
import ChecklistOutlined           from '@mui/icons-material/ChecklistOutlined';
import ScheduleOutlined            from '@mui/icons-material/ScheduleOutlined';
import SchoolOutlined              from '@mui/icons-material/SchoolOutlined';
import MenuBookOutlined            from '@mui/icons-material/MenuBookOutlined';
import QuizOutlined                from '@mui/icons-material/QuizOutlined';

interface IconOption {
  label: string;
  Icon:  SvgIconComponent;
}

export const ICON_OPTIONS: Record<string, IconOption> = {
  shield:        { label: 'Shield (safety)',     Icon: VerifiedUserOutlined },
  warning:       { label: 'Warning',             Icon: WarningAmberOutlined },
  hardhat:       { label: 'Health & Safety',     Icon: HealthAndSafetyOutlined },
  medical_kit:   { label: 'Medical Kit',         Icon: MedicalServicesOutlined },
  hospital:      { label: 'Hospital',            Icon: LocalHospitalOutlined },
  fishing:       { label: 'Fishing rod',         Icon: PhishingOutlined },
  fish:          { label: 'Fish',                Icon: SetMealOutlined },
  boat:          { label: 'Boat',                Icon: DirectionsBoatOutlined },
  sailing:       { label: 'Sailing',             Icon: SailingOutlined },
  anchor:        { label: 'Anchor',              Icon: AnchorOutlined },
  waves:         { label: 'Waves',               Icon: WavesOutlined },
  net:           { label: 'Net (grid)',          Icon: WindowOutlined },
  grid:          { label: 'Grid (apps)',         Icon: GridViewOutlined },
  share:         { label: 'Share / Knot',        Icon: ShareOutlined },
  link:          { label: 'Link',                Icon: LinkOutlined },
  tools:         { label: 'Tools',               Icon: BuildOutlined },
  handyman:      { label: 'Handyman',            Icon: HandymanOutlined },
  leaf:          { label: 'Leaf (environment)',  Icon: SpaOutlined },
  globe:         { label: 'Globe',               Icon: PublicOutlined },
  groups:        { label: 'Groups',              Icon: GroupsOutlined },
  support:       { label: 'Customer support',    Icon: SupportAgentOutlined },
  gavel:         { label: 'Gavel (legal)',       Icon: GavelOutlined },
  policy:        { label: 'Policy',              Icon: PolicyOutlined },
  location:      { label: 'Location',            Icon: PlaceOutlined },
  restaurant:    { label: 'Food / Hygiene',      Icon: RestaurantOutlined },
  cleaning:      { label: 'Cleaning',            Icon: CleaningServicesOutlined },
  assignment:    { label: 'Assignment',          Icon: AssignmentOutlined },
  checklist:     { label: 'Checklist',           Icon: ChecklistOutlined },
  schedule:      { label: 'Schedule',            Icon: ScheduleOutlined },
  school:        { label: 'School',              Icon: SchoolOutlined },
  book:          { label: 'Book',                Icon: MenuBookOutlined },
  quiz:          { label: 'Quiz',                Icon: QuizOutlined },
};

const FALLBACK_ICON = MenuBookOutlined;

export function getIconByKey(key: string): SvgIconComponent {
  return ICON_OPTIONS[key]?.Icon ?? FALLBACK_ICON;
}
