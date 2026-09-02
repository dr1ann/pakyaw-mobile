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
    help: 'Enter the 6-digit verification code sent to your mobile number.',
  },
  barangayAddress: {
    label: 'Barangay address',
    placeholder: 'House or street, barangay, city or municipality',
    help: 'Enter an address where Pakyaw can reach you, including your barangay and city or municipality.',
  },
  emergencyContactMobile: {
    label: 'Emergency contact mobile',
    placeholder: '0917 123 4567',
    help: 'Use a Philippine mobile number for someone Pakyaw can contact in an emergency.',
  },
  plateNumber: {
    label: 'Plate number',
    placeholder: 'Ex: ABC-1234 or MV file number',
    help: 'Copy the plate number exactly as shown on the vehicle or current Certificate of Registration. Plate numbers can use different formats.',
  },
  unitBodyNumber: {
    label: 'Unit/body number',
    placeholder: 'Ex: 017',
    help: 'Enter the fleet, operator, or body number shown on your vehicle. Ask your operator if you’re unsure.',
  },
  vehicleDescription: {
    label: 'Vehicle description',
    placeholder: 'Ex: White Toyota Vios, 2022',
    help: 'Describe the make, model, color, and year so Pakyaw Operations can identify the vehicle.',
  },
  ownerOperatorInfo: {
    label: 'Owner/operator information',
    placeholder: 'Ex: Pedro Santos',
    help: 'Enter the registered vehicle owner or operator. You still need this information if you own the vehicle.',
  },
  ownerSwitch: {
    label: 'I am the registered vehicle owner',
    help: 'Turn this on only if the registration lists you as the owner. You still need the owner or operator information.',
  },
  orcrNumber: {
    label: 'OR/CR number',
    placeholder: 'Ex: identifier on your latest OR/CR',
    help: 'Copy the identifier from your latest Official Receipt or Certificate of Registration.',
  },
  orcrExpiry: {
    label: 'OR/CR expiry',
    help: 'Choose the validity date shown on your latest OR/CR.',
  },
  licenseNumber: {
    label: "Driver's license number",
    placeholder: 'Ex: license number',
    help: 'Copy the license number exactly as shown. Formats can vary between current and older licenses.',
  },
  licenseExpiry: {
    label: "Driver's license expiry",
    help: 'Choose the expiry date shown on your driver’s license.',
  },
  franchiseType: {
    label: 'Franchise type',
    placeholder: 'Ex: CPC, PA, or document type',
    help: 'Enter the franchise document type exactly as shown on the document.',
  },
  franchiseNumber: {
    label: 'Franchise number',
    placeholder: 'Ex: franchise number',
    help: 'Copy the franchise or case identifier exactly from the document. LTFRB identifiers can vary by document and region.',
  },
  franchiseExpiry: {
    label: 'Franchise expiry',
    help: 'Choose the expiry date shown on your franchise document.',
  },
  driversLicenseDocument: {
    label: "Driver's license document",
    help: 'Upload a clear image or PDF of your valid driver’s license.',
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
  application_status_not_submittable: 'You can’t submit this application yet.',
  full_legal_name_required: 'Enter your full legal name.',
  verified_mobile_required: 'Verify your mobile number to continue.',
  verified_mobile_invalid: 'Enter a Philippine mobile number.',
  barangay_address_required: 'Enter your barangay address.',
  emergency_contact_name_required: 'Enter an emergency contact name.',
  emergency_contact_mobile_required: 'Enter an emergency contact mobile number.',
  emergency_contact_mobile_invalid: 'Enter a valid Philippine emergency contact mobile number.',
  plate_number_required: 'Enter the vehicle plate number.',
  unit_body_number_required: 'Enter the unit or body number.',
  vehicle_description_required: 'Enter the vehicle description.',
  vehicle_type_required: 'Choose a vehicle type.',
  owner_operator_info_required: 'Enter the owner or operator information.',
  driver_owner_flag_invalid: 'Confirm whether you are the registered vehicle owner.',
  orcr_number_required: 'Enter the OR/CR number.',
  orcr_expiry_required: 'Choose the OR/CR expiry date.',
  orcr_expiry_invalid: 'Choose a valid OR/CR expiry date.',
  orcr_expiry_expired: 'Choose a current OR/CR expiry date.',
  license_number_required: 'Enter the driver’s license number.',
  license_expiry_required: 'Choose the driver’s license expiry date.',
  license_expiry_invalid: 'Choose a valid driver’s license expiry date.',
  license_expiry_expired: 'Choose a current driver’s license expiry date.',
  franchise_type_required: 'Enter the franchise type.',
  franchise_number_required: 'Enter the franchise number.',
  franchise_expiry_required: 'Choose the franchise expiry date.',
  franchise_expiry_invalid: 'Choose a valid franchise expiry date.',
  franchise_expiry_expired: 'Choose a current franchise expiry date.',
  document_missing: 'Upload this required document.',
  document_under_review: 'This document is currently under review.',
  document_rejected: 'Replace this document before you submit.',
  document_expired: 'Replace this document before you submit.',
  document_invalid_state: 'Upload this document again.',
  document_identification_required: 'Enter the identification number for this document.',
  document_issuance_date_required: 'Choose the document issuance date.',
  document_issuance_date_invalid: 'Choose a valid document issuance date.',
  document_expiry_date_required: 'Choose the document expiry date.',
  document_expiry_date_invalid: 'Choose a valid document expiry date.',
  document_expiry_date_expired: 'Choose a current document expiry date.',
};

export function submissionIssueMessage(code: SubmissionIssueCode): string {
  return submissionIssueMessages[code];
}
