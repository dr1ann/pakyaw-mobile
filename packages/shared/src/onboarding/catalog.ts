export type OnboardingVehicleType = {
  readonly id: string;
  readonly type: string;
  readonly capacity: number;
  readonly wheels: number;
  readonly status: 'active';
  readonly icon: string | null;
};

export type OnboardingDocumentRequirement = {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly active: boolean;
  readonly requiredForApplication: boolean;
  readonly requiredForOnline: boolean;
  readonly requiresIdentification: boolean;
  readonly requiresIssuanceDate: boolean;
  readonly requiresExpiryDate: boolean;
  readonly vehicleTypeIds: readonly string[];
  readonly sortOrder: number;
};

export type DriverOnboardingCatalog = {
  readonly vehicleTypes: readonly OnboardingVehicleType[];
  readonly documentRequirements: readonly OnboardingDocumentRequirement[];
};

export function requirementAppliesToVehicle(
  requirement: OnboardingDocumentRequirement,
  vehicleTypeId: string | undefined,
): boolean {
  return requirement.vehicleTypeIds.length === 0
    || vehicleTypeId === undefined
    || requirement.vehicleTypeIds.includes(vehicleTypeId);
}
