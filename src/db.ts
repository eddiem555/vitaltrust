// VitalTrust Mock Database — unified seed (50 patients, externalized appointments & messages)
import { INITIAL_APPOINTMENTS } from './appointments';
import { INITIAL_MESSAGES } from './messages';
import { careTeamForPatientIndex } from './appointments';

export const DEFAULT_PASSWORD = 'L@bt3sting';

const STABLE_CONDITIONS = [
  'Hypertension', 'Diabetes', 'Recovery', 'Allergies', 'Asthma',
  'Hyperlipidemia', 'Arrhythmia', 'Chronic Pain', 'Insomnia'
];

const DRUG_NAMES = ['Amlodipine', 'Metformin', 'Lisinopril', 'Atorvastatin', 'Levothyroxine', 'Albuterol', 'Ibuprofen', 'Gabapentin', 'Omeprazole', 'Furosemide'];
const DOSAGES = ['5mg', '10mg', '20mg', '40mg', '50mg', '100mg', '500mg'];
const LAB_TESTS = ['Complete Blood Count', 'Lipid Panel', 'HbA1c', 'Metabolic Panel', 'Imaging'];
const LAB_RESULTS = ['Normal', 'Stable', 'Borderline', 'Requires Review'];
const BILL_DESC = ['Consultation Fee', 'Lab Processing', 'Administrative Fee', 'Pharmacy Component'];
const BILL_STATUS = ['paid', 'unpaid', 'pending'] as const;

function getMedsForCondition(condition: string): string[] {
  switch (condition) {
    case 'Healthy': return ['Omega-3 Tablets', 'Vitamin D3 1000IU'];
    case 'Hypertension': return ['Amlodipine 5mg', 'Lisinopril 10mg'];
    case 'Diabetes': return ['Metformin 500mg'];
    case 'Recovery': return ['Ibuprofen 400mg'];
    case 'Allergies': return ['Claritin 10mg'];
    case 'Asthma': return ['Albuterol Inhaler'];
    case 'Hyperlipidemia': return ['Atorvastatin 20mg'];
    case 'Arrhythmia': return ['Metoprolol 25mg'];
    case 'Chronic Pain': return ['Gabapentin 100mg'];
    case 'Insomnia': return ['Melatonin 5mg'];
    default: return ['Multivitamins'];
  }
}

function conditionForIndex(patientNum: number): string {
  if (patientNum % 5 === 0 || patientNum % 5 === 2) return 'Healthy';
  return STABLE_CONDITIONS[(patientNum - 1) % STABLE_CONDITIONS.length];
}

function formatTenDigitPhone(phone: string, index: number): string {
  const cleaned = (phone || '').replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  const areaNo = (201 + (index * 13) % 700).toString().padStart(3, '0');
  const exch = (301 + (index * 7) % 600).toString().padStart(3, '0');
  const line = (1000 + (index * 19) % 8999).toString().padStart(4, '0');
  return `${areaNo}-${exch}-${line}`;
}

// ─── Staff seed records ─────────────────────────────────────────────────────

const ADMIN_USERS = [
  { id: 'admin1', realName: 'Eddie Architect', email: 'eddie.architect@vitaltrust.com', phone: '555-0100', address: '170 West Tasman Dr, San Jose, CA 95134', clearance_level: 3, internal_notes: 'Superuser level 3 access. Configures security controls for duo-oidc proxy and micro-segmentation models. High-Value administrative target.' },
  { id: 'admin2', realName: 'Sarah Systems', email: 'sarah.systems@vitaltrust.com', phone: '555-0101', address: '170 West Tasman Dr, San Jose, CA 95134' },
  { id: 'admin3', realName: 'David Duval', email: 'david.duval@vitaltrust.com', phone: '555-0102', address: '170 West Tasman Dr, San Jose, CA 95134' },
  { id: 'admin4', realName: 'Alice Access', email: 'alice.access@vitaltrust.com', phone: '555-0103', address: '170 West Tasman Dr, San Jose, CA 95134' },
  { id: 'admin5', realName: 'Wendy Workload', email: 'wendy.workload@vitaltrust.com', phone: '555-0104', address: '170 West Tasman Dr, San Jose, CA 95134' },
];

const DOCTOR_USERS = [
  { id: 'doctor1', realName: 'Gregory House', email: 'g.house@hospital.com', phone: '555-0201', address: '1 Mercer St, Princeton, NJ 08540', npi_number: '1689701143' },
  { id: 'doctor2', realName: 'Stephen Strange', email: 's.strange@sanctum.com', phone: '555-0202', address: '177A Bleecker St, New York, NY 10012' },
  { id: 'doctor3', realName: 'Meredith Grey', email: 'm.grey@hospital.com', phone: '555-0203', address: '300 Terry Ave N, Seattle, WA 98109' },
  { id: 'doctor4', realName: 'Leonard McCoy', email: 'l.mccoy@starfleet.com', phone: '555-0204', address: '1 Enterprise Way, San Francisco, CA 94105' },
  { id: 'doctor5', realName: 'Beverly Crusher', email: 'b.crusher@starfleet.com', phone: '555-0205', address: '100 Starfleet Plaza, San Francisco, CA 94111' },
  { id: 'doctor6', realName: 'Doogie Howser', email: 'd.howser@hospital.com', phone: '555-0206', address: '550 S Hope St, Los Angeles, CA 90071' },
  { id: 'doctor7', realName: 'James Wilson', email: 'j.wilson@hospital.com', phone: '555-0207', address: '1 Mercer St, Princeton, NJ 08540' },
  { id: 'doctor8', realName: 'Hannibal Lecter', email: 'h.lecter@hospital.com', phone: '555-0208', address: '100 Constitution Ave, Baltimore, MD 21202' },
  { id: 'doctor9', realName: 'John Watson', email: 'j.watson@london.uk', phone: '555-0209', address: '221B Baker St, London, NW1 6XE' },
  { id: 'doctor10', realName: 'Ken Jeong', email: 'k.jeong@comedy.com', phone: '555-0210', address: '6801 Hollywood Blvd, Hollywood, CA 90028' },
];

const NURSE_USERS = [
  { id: 'nurse1', realName: 'Nurse Ratched', email: 'm.ratched@vitaltrust.com', phone: '555-0301', address: '2600 Center St NE, Salem, OR 97301', assigned_ward: 'Mental Health Residence - Ward B' },
  { id: 'nurse2', realName: 'Abby Lockhart', email: 'a.lockhart@vitaltrust.com', phone: '555-0302', address: '1901 W Harrison St, Chicago, IL 60612' },
  { id: 'nurse3', realName: 'Jackie Peyton', email: 'j.peyton@vitaltrust.com', phone: '555-0303', address: '421 E 14th St, New York, NY 10009' },
  { id: 'nurse4', realName: 'Nurse Joy', email: 'joy@vitaltrust.com', phone: '555-0304', address: '1 Main St, Pallet Town, Kanto 00001' },
  { id: 'nurse5', realName: 'Nurse Carol Hathaway', email: 'c.hathaway@vitaltrust.com', phone: '555-0305', address: '1901 W Harrison St, Chicago, IL 60612' },
  { id: 'nurse6', realName: 'Nurse Christine Chapel', email: 'c.chapel@starfleet.com', phone: '555-0306', address: '1 Enterprise Way, San Francisco, CA 94105' },
  { id: 'nurse7', realName: 'Nurse Carla Espinosa', email: 'c.espinosa@hospital.com', phone: '555-0307', address: 'Sacred Heart, Los Angeles, CA 90026' },
  { id: 'nurse8', realName: 'Nurse Trixie Franklin', email: 't.franklin@midwives.uk', phone: '555-0308', address: 'Nonnatus House, London, UK' },
  { id: 'nurse9', realName: 'Nurse Julia Ogden', email: 'j.ogden@toronto.ca', phone: '555-0309', address: 'Toronto Station #4, Toronto, ON' },
  { id: 'nurse10', realName: 'Nurse Margaret Houlihan', email: 'm.houlihan@army.mil', phone: '555-0310', address: 'MASH 4077, South Korea' },
];

/** All 50 patient identities — single roster */
const PATIENT_ROSTER: Array<{
  name: string;
  email: string;
  phone: string;
  address: string;
  dob: string;
  ssn: string;
  insurance_id?: string;
  lastVisit: string;
}> = [
  { name: 'Sarah Smith', email: 'sarah@ex.com', phone: '555-0101', address: '742 Evergreen Terrace, Springfield, OR 97477', dob: '1992-08-20', ssn: '999-22-1111', insurance_id: 'AET-3211421', lastVisit: '2024-02-15' },
  { name: 'John Doe', email: 'john@ex.com', phone: '555-0102', address: '123 Maple St, Anycity, OH 43210', dob: '1985-05-12', ssn: '555-01-4321', insurance_id: 'BCBS-8812739', lastVisit: '2024-03-10' },
  { name: 'Robert Ross', email: 'bob@ex.com', phone: '555-0103', address: '1007 Mountain Drive, Gotham, NJ 07001', dob: '1970-12-01', ssn: '999-44-3333', insurance_id: 'CIG-9481231', lastVisit: '2024-04-01' },
  { name: 'Emma Watson', email: 'emma@ex.com', phone: '555-0104', address: 'Platform 9 3/4, London, UK NW1 2AL', dob: '1990-04-15', ssn: '999-55-4444', lastVisit: '2024-03-22' },
  { name: 'Bruce Wayne', email: 'bruce@wayne.com', phone: '555-0105', address: '1007 Mountain Drive, Gotham, NJ 07001', dob: '1980-02-19', ssn: '999-66-5555', lastVisit: '2024-04-10' },
  { name: 'Clark Kent', email: 'clark@kent.com', phone: '555-0106', address: '344 Clinton St, Metropolis, NY 10001', dob: '1978-06-18', ssn: '999-77-6666', lastVisit: '2024-01-15' },
  { name: 'Diana Prince', email: 'diana@amazon.com', phone: '555-0107', address: '1 Paradise Island Way, Themyscira, GR 85100', dob: '1918-01-01', ssn: '999-88-7777', lastVisit: '2024-02-20' },
  { name: 'Peter Parker', email: 'peter@pub.com', phone: '555-0108', address: '20 Ingram St, Queens, NY 11375', dob: '2001-08-10', ssn: '999-99-8888', lastVisit: '2024-04-05' },
  { name: 'Tony Stark', email: 'tony@stark.com', phone: '555-0109', address: '10880 Wilshire Blvd, Malibu, CA 90265', dob: '1970-05-29', ssn: '999-00-9999', lastVisit: '2024-03-15' },
  { name: 'Steve Rogers', email: 'cap@usa.gov', phone: '555-0110', address: '569 Lefferts Ave, Brooklyn, NY 11203', dob: '1918-07-04', ssn: '999-11-0000', lastVisit: '2024-04-12' },
  { name: 'Natasha Romanoff', email: 'nat@spy.gov', phone: '555-0111', address: '100 Broadway, New York, NY 10005', dob: '1984-11-22', ssn: '999-22-1111', lastVisit: '2024-03-01' },
  { name: 'Thor Odinson', email: 'thor@asgard.com', phone: '555-0112', address: '1 Asgardian Way, Tromsø, NO 9008', dob: '0964-01-01', ssn: '999-33-2222', lastVisit: '2024-02-14' },
  { name: 'Wanda Maximoff', email: 'wanda@magic.com', phone: '555-0113', address: '2800 Sherwood Terrace, Westview, NJ 07001', dob: '1989-02-10', ssn: '999-44-3333', lastVisit: '2024-04-18' },
  { name: 'Vision', email: 'viz@bot.com', phone: '555-0114', address: '2800 Sherwood Terrace, Westview, NJ 07001', dob: '2015-05-05', ssn: '999-55-4444', lastVisit: '2024-04-18' },
  { name: 'Sam Wilson', email: 'sam@falcon.com', phone: '555-0115', address: '1600 Pennsylvania Ave NW, Washington, DC 20500', dob: '1978-04-14', ssn: '999-66-5555', lastVisit: '2024-03-25' },
  { name: 'Bucky Barnes', email: 'bucky@soldier.com', phone: '555-0116', address: '569 Lefferts Ave, Brooklyn, NY 11203', dob: '1917-03-10', ssn: '999-77-6666', lastVisit: '2024-04-02' },
  { name: 'Scott Lang', email: 'scott@ant.com', phone: '555-0117', address: '3711 22nd St, San Francisco, CA 94114', dob: '1969-04-06', ssn: '999-88-7777', lastVisit: '2024-03-30' },
  { name: 'Hope Pym', email: 'hope@wasp.com', phone: '555-0118', address: '100 Pym Tech Plaza, San Francisco, CA 94107', dob: '1979-01-01', ssn: '999-99-8888', lastVisit: '2024-03-30' },
  { name: "T'Challa", email: 'king@wakanda.com', phone: '555-0119', address: '1 Palace Grounds, Birnin Zana, WK 00001', dob: '1980-11-24', ssn: '999-00-9999', lastVisit: '2024-04-20' },
  { name: 'Carol Danvers', email: 'carol@marvel.com', phone: '555-0120', address: '1 Space Station Blvd, Orbit, Earth 00000', dob: '1960-10-21', ssn: '999-11-0000', lastVisit: '2024-04-15' },
  ...['Clint Barton', 'Arthur Curry', 'Barry Allen', 'Hal Jordan', 'Victor Stone', 'Oliver Queen', 'Lois Lane', 'Lex Luthor', 'Wade Wilson', 'Logan Howlett', 'Charles Xavier', 'Jean Grey', 'Scott Summers', 'Ororo Munroe', 'Matt Murdock', 'Jessica Jones', 'Luke Cage', 'Danny Rand', 'Frank Castle', 'Peter Quill', 'Gamora Zen', 'Drax Destroyer', 'Groot Wood', 'Rocket Raccoon', 'Jane Foster', 'Nick Fury', 'Maria Hill', 'Phil Coulson', 'Melinda May', 'Daisy Johnson'].map((name, idx) => {
    const num = 21 + idx;
    return {
      name,
      email: name.toLowerCase().replace(/\s+/g, '') + '@ex.com',
      phone: `555-01${20 + num}`,
      address: `${100 + num} Main St, Springfield`,
      dob: `${1980 + (num % 20)}-05-${String(10 + (num % 15)).padStart(2, '0')}`,
      ssn: `999-55-${1000 + num}`,
      insurance_id: `BCBS-${3211000 + num * 77}`,
      lastVisit: `2024-0${1 + (num % 4)}-${String(5 + (num % 20)).padStart(2, '0')}`,
    };
  }),
];

function buildUsers() {
  const admins = ADMIN_USERS.map((a) => ({ ...a, role: 'admin' as const, password: DEFAULT_PASSWORD }));
  const doctors = DOCTOR_USERS.map((d) => ({ ...d, role: 'doctor' as const, password: DEFAULT_PASSWORD }));
  const nurses = NURSE_USERS.map((n) => ({ ...n, role: 'nurse' as const, password: DEFAULT_PASSWORD }));
  const patients = PATIENT_ROSTER.map((p, i) => ({
    id: `patient${i + 1}`,
    role: 'patient' as const,
    password: DEFAULT_PASSWORD,
    realName: p.name,
    email: p.email,
    phone: p.phone,
    address: p.address,
  }));
  return [...admins, ...doctors, ...nurses, ...patients];
}

function buildPatients() {
  return PATIENT_ROSTER.map((p, i) => {
    const num = i + 1;
    const { doctorId, nurseId } = careTeamForPatientIndex(num);
    const condition = conditionForIndex(num);
    return {
      id: `patient${num}`,
      name: p.name,
      dob: p.dob,
      ssn: p.ssn,
      insurance_id: p.insurance_id,
      phone: p.phone,
      address: p.address,
      email: p.email,
      condition,
      medications: getMedsForCondition(condition),
      lastVisit: p.lastVisit,
      assignedDoctorId: doctorId,
      assignedNurseId: nurseId,
      status: 'active' as const,
    };
  });
}

function buildDoctors() {
  return DOCTOR_USERS.map((d) => ({ id: d.id, name: `Dr. ${d.realName.replace(/^Dr\.\s*/, '')}` }));
}

function buildNurses() {
  return NURSE_USERS.map((n) => ({ id: n.id, name: n.realName.startsWith('Nurse') ? n.realName : `Nurse ${n.realName}` }));
}

function buildLabResults() {
  const labs: Array<{ id: string; patientId: string; testName: string; date: string; result: string; notes: string }> = [];
  for (let i = 1; i <= 50; i++) {
    const count = 1 + (i % 5);
    for (let j = 0; j < count; j++) {
      labs.push({
        id: `lab_patient${i}_${j}`,
        patientId: `patient${i}`,
        testName: LAB_TESTS[(i + j) % LAB_TESTS.length],
        date: `2026-07-${String(10 + ((i + j * 2) % 20)).padStart(2, '0')}`,
        result: LAB_RESULTS[(i + j) % LAB_RESULTS.length],
        notes: 'Result recorded in Clinical portal.',
      });
    }
  }
  return labs;
}

function buildBilling() {
  const bills: Array<{ id: string; patientId: string; date: string; description: string; amount: number; status: typeof BILL_STATUS[number] }> = [];
  for (let i = 1; i <= 50; i++) {
    const count = i % 11;
    for (let j = 0; j < count; j++) {
      bills.push({
        id: `bill_patient${i}_${j}`,
        patientId: `patient${i}`,
        date: `2026-06-${String(10 + ((i + j) % 20)).padStart(2, '0')}`,
        description: BILL_DESC[(i + j) % BILL_DESC.length],
        amount: 50 + ((i * 17 + j * 23) % 250),
        status: BILL_STATUS[(i + j) % BILL_STATUS.length],
      });
    }
  }
  return bills;
}

function buildMedicationsDetailed() {
  const meds: Array<{ id: string; patientId: string; name: string; dosage: string; frequency: string; startDate: string; status: string }> = [];
  for (let i = 1; i <= 50; i++) {
    const count = 1 + (i % 4);
    for (let j = 0; j < count; j++) {
      meds.push({
        id: `med_patient${i}_${j}`,
        patientId: `patient${i}`,
        name: DRUG_NAMES[(i + j) % DRUG_NAMES.length],
        dosage: DOSAGES[(i + j) % DOSAGES.length],
        frequency: ['Once daily', 'Twice daily', 'As needed'][(i + j) % 3],
        startDate: '2026-01-01',
        status: 'pending',
      });
    }
  }
  return meds;
}

export const INITIAL_DB = {
  users: buildUsers(),
  patients: buildPatients(),
  nurses: buildNurses(),
  doctors: buildDoctors(),
  appointments: INITIAL_APPOINTMENTS,
  lab_results: buildLabResults(),
  billing: buildBilling(),
  medications_detailed: buildMedicationsDetailed(),
  messages: INITIAL_MESSAGES,
  logs: [
    {
      id: 'log_init',
      timestamp: new Date().toISOString(),
      userId: 'system',
      userName: 'System',
      role: 'system',
      activity: 'Database Initialized',
      status: 'Success',
      details: 'VitalTrust distributed healthcare portal backend initialized successfully.',
      nodeRole: 'standalone',
    },
  ],
};

// ─── Post-init enrichment (PII, vitals, role metadata) ──────────────────────

INITIAL_DB.users.forEach((user: any, index: number) => {
  user.phone = formatTenDigitPhone(user.phone || '', index);
});

INITIAL_DB.patients.forEach((patient: any, index: number) => {
  const patientNum = index + 1;
  patient.condition = conditionForIndex(patientNum);
  patient.medications = getMedsForCondition(patient.condition);
  patient.vitals = {
    hr: (68 + (patientNum % 15)).toString(),
    temp: (97.7 + (patientNum % 12) * 0.1).toFixed(1),
    bp: `${115 + (patientNum % 13)}/${74 + (patientNum % 9)}`,
    lastUpdated: '2026-05-28',
  };
  const { doctorId, nurseId } = careTeamForPatientIndex(patientNum);
  patient.assignedDoctorId = doctorId;
  patient.assignedNurseId = nurseId;

  const matchUser = INITIAL_DB.users.find((u: any) => u.id === patient.id);
  patient.phone = matchUser ? matchUser.phone : formatTenDigitPhone(patient.phone || '', index + 100);

  if (!patient.ssn) patient.ssn = `999-55-${1000 + patientNum}`;
  if (!patient.insurance_id) {
    const providers = ['BCBS', 'AET', 'CIG', 'UNI', 'HUM'];
    patient.insurance_id = `${providers[index % providers.length]}-${3211000 + patientNum * 77}`;
  }
  patient.clinical_notes = `Patient is currently being monitored for ${patient.condition}. The recorded treatment plan consists of physical observation and active prescription management: ${patient.medications.join(', ')}. Responding well to therapy. High-value clinical monitoring target.`;
});

INITIAL_DB.users.forEach((user: any, index: number) => {
  if (user.role === 'admin') {
    if (user.clearance_level === undefined) user.clearance_level = (index % 3) + 1;
    if (!user.internal_notes) {
      user.internal_notes = `Superuser level ${user.clearance_level} access. Handles operational compliance and role mappings for duo-oidc federation. Fully authorized administrative profile for ${user.realName}.`;
    }
  } else if (user.role === 'doctor') {
    if (!user.npi_number) user.npi_number = `${1689701000 + index * 123}`;
    if (!user.internal_notes) {
      user.internal_notes = `Credentialed specialist doctor. Professional licensing active, NPI directory checked. Chief attending notes verified for ${user.realName}. Registered location: ${user.address}.`;
    }
  } else if (user.role === 'nurse') {
    if (!user.assigned_ward) {
      const wards = ['Emergency Room', 'Mental Health Residence - Ward B', 'Cardiac ICU', 'Surgical Ward', 'Pediatric Wing'];
      user.assigned_ward = wards[index % wards.length];
    }
    if (!user.internal_notes) {
      user.internal_notes = `Licensed practicing Nurse. Clinical scheduling active. Assigned to the high-acuity ${user.assigned_ward}. Primary focus area: emergency patient care support.`;
    }
  } else if (user.role === 'patient') {
    const pRecord = INITIAL_DB.patients.find((p: any) => p.id === user.id);
    if (pRecord) {
      user.ssn = pRecord.ssn;
      user.insurance_id = pRecord.insurance_id;
      user.clinical_notes = pRecord.clinical_notes;
    } else {
      user.ssn = `999-55-220${index}`;
      user.insurance_id = `BCBS-1100${index}`;
      user.clinical_notes = 'Routine clinical assessment. Stable diagnostic values.';
    }
  }
});

export const db_mock = JSON.parse(JSON.stringify(INITIAL_DB));
