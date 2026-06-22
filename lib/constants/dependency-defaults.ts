import type { DependencyCategory } from '@/lib/types/hvac';

export const DEPENDENCY_DEFAULTS: Record<DependencyCategory, string[]> = {
  architect: [
    'Design Intent',
    '2D Autocad Plan',
    '3D Renders',
    'GFC Drawings',
    'Specifications',
    'Material Selection',
  ],
  client: [
    'Design Approval',
    'Material Approval',
    'Equipment Approval',
    'Payment Clearances',
    'Contract Approach',
  ],
  consultant: [
    'Technical Drawing',
    'Specification',
    'Vendor Suggestion',
    'Quality List',
    'Estimated Cost',
  ],
  inspector: [
    'Material Samples',
    'Material Delivery',
  ],
  contractor: [
    'Manpower',
    'Deadlines',
    'Quality of Work',
    'Mockup on Site',
  ],
};
