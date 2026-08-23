import type { SubmissionIssueCode } from '@pakyaw/shared/onboarding';

export type FieldGuidance = {
  readonly label: string;
  readonly placeholder?: string;
  readonly help?: string;
};

export const onboardingFieldGuidance = {
  mobile: {
    label: 'Mobile number',
    placeholder: '0917 123 4567',
    help: 'Use a Philippine mobile number: 09xxxxxxxxx, 9xxxxxxxxx, or +639xxxxxxxxx.',
  },
  otp: {
    label: 'SMS code',
    placeholder: '6-digit verification code',
    help: 'Enter the six-digit verification code sent by Firebase Authentication.',
  },
  barangayAddress: {
    label: 'Barangay address',
    placeholder: 'House/Street, Barangay, City or Municipality',
    help: 'Enter the address where you can be contacted, including your barangay and city or municipality.',
  },
  emergencyContactMobile: {
    label: 'Emergency contact mobile',
    placeholder: '0917 123 4567',
    help: 'Use a Philippine mobile number for someone Pakyaw can contact in an emergency.',
  },
  plateNumber: {
    label: 'Plate number',
    placeholder: 'Enter exactly as shown on the plate or CR',
    help: 'Copy the assigned plate number exactly from the vehicle plate or current Certificate of Registration. Plate designs have multiple valid formats.',
  },
  unitBodyNumber: {
    label: 'Unit/body number',
    placeholder: 'Fleet, operator, or body number shown on the vehicle',
    help: 'Enter the fleet, operator, or body number displayed on your vehicle. Ask your operator if you are unsure.',
  },
  vehicleDescription: {
    label: 'Vehicle description',
    placeholder: 'White Toyota Vios, 2022',
    help: 'Describe the make, model, color, and year so operations can identify the vehicle.',
  },
  ownerOperatorInfo: {
    label: 'Owner/operator information',
    placeholder: 'Registered owner or operator name',
    help: 'Enter the registered vehicle owner or operator. This is required even when you are the owner.',
  },
  ownerSwitch: {
    label: 'I am the registered vehicle owner',
    help: 'Turn this on only when the name on the registration is your own. Owner/operator information is still required.',
  },
  orcrNumber: {
    label: 'OR/CR number',
    placeholder: 'Enter the identifier shown on the latest OR/CR',
    help: 'Copy the identifier from your latest Official Receipt or Certificate of Registration. The contract does not assume it is always a Motor Vehicle File Number.',
  },
  orcrExpiry: {
    label: 'OR/CR expiry',
    help: 'Choose the registration-validity date printed on your latest OR/CR. The app saves it as YYYY-MM-DD.',
  },
  licenseNumber: {
    label: "Driver's license number",
    placeholder: "Enter exactly as printed on the driver's license",
    help: "Copy the license number exactly as printed. Current and legacy licenses do not have one safely assumed universal format.",
  },
  licenseExpiry: {
    label: "Driver's license expiry",
    help: 'Choose the expiry date printed on your driver\'s license. The app saves it as YYYY-MM-DD.',
  },
  franchiseType: {
    label: 'Franchise type',
    placeholder: 'CPC, PA, or document type shown on the franchise',
    help: 'Enter the franchise document type exactly as shown on the document.',
  },
  franchiseNumber: {
    label: 'Franchise number',
    placeholder: 'Enter exactly as printed on the franchise document',
    help: 'Copy the franchise or case identifier exactly from the document. LTFRB identifiers can vary by document and region.',
  },
  franchiseExpiry: {
    label: 'Franchise expiry',
    help: 'Choose the expiry date printed on your franchise document. The app saves it as YYYY-MM-DD.',
  },
  driversLicenseDocument: {
    label: "Driver's license document",
    help: 'Upload a clear image or PDF of your valid driver\'s license. It is stored privately and is not public.',
  },
  orcrDocument: {
    label: 'OR/CR document',
    help: 'Upload a clear image or PDF of your current Official Receipt and Certificate of Registration document.',
  },
  franchiseDocument: {
    label: 'Franchise document',
    help: 'Upload a clear image or PDF of your valid franchise document.',
  },
} as const satisfies Record<string, FieldGuidance>;

const submissionIssueMessages: Readonly<Record<SubmissionIssueCode, string>> = {
  application_status_not_submittable: 'This application cannot be submitted in its current status.',
  full_legal_name_required: 'Enter your full legal name.',
  verified_mobile_required: 'A verified mobile number is required.',
  verified_mobile_invalid: 'The verified mobile number must be a Philippine mobile number.',
  barangay_address_required: 'Enter your barangay address.',
  emergency_contact_name_required: 'Enter an emergency contact name.',
  emergency_contact_mobile_required: 'Enter an emergency contact mobile number.',
  emergency_contact_mobile_invalid: 'Enter a valid Philippine emergency contact mobile number.',
  plate_number_required: 'Enter the vehicle plate number.',
  unit_body_number_required: 'Enter the unit or body number.',
  vehicle_description_required: 'Enter the vehicle description.',
  owner_operator_info_required: 'Enter the owner or operator information.',
  driver_owner_flag_invalid: 'Confirm whether you are the registered vehicle owner.',
  orcr_number_required: 'Enter the OR/CR number.',
  orcr_expiry_required: 'Select the OR/CR expiry date.',
  orcr_expiry_invalid: 'Select a valid OR/CR expiry date.',
  orcr_expiry_expired: 'The OR/CR expiry date has already passed.',
  license_number_required: "Enter the driver's license number.",
  license_expiry_required: "Select the driver's license expiry date.",
  license_expiry_invalid: "Select a valid driver's license expiry date.",
  license_expiry_expired: "The driver's license has expired.",
  franchise_type_required: 'Enter the franchise type.',
  franchise_number_required: 'Enter the franchise number.',
  franchise_expiry_required: 'Select the franchise expiry date.',
  franchise_expiry_invalid: 'Select a valid franchise expiry date.',
  franchise_expiry_expired: 'The franchise has expired.',
  document_missing: 'Upload this required private document.',
  document_under_review: 'This document is currently under review.',
  document_rejected: 'Replace this rejected document before submitting.',
  document_expired: 'Replace this expired document before submitting.',
  document_invalid_state: 'Upload this document again.',
};

export function submissionIssueMessage(code: SubmissionIssueCode): string {
  return submissionIssueMessages[code];
}
