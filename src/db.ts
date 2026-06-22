// VitalTrust Mock Database
export const DEFAULT_PASSWORD = "L@bt3sting";

const EXTRA_PATIENT_NAMES = [
  "Clint Barton",
  "Arthur Curry",
  "Barry Allen",
  "Hal Jordan",
  "Victor Stone",
  "Oliver Queen",
  "Lois Lane",
  "Lex Luthor",
  "Wade Wilson",
  "Logan Howlett",
  "Charles Xavier",
  "Jean Grey",
  "Scott Summers",
  "Ororo Munroe",
  "Matt Murdock",
  "Jessica Jones",
  "Luke Cage",
  "Danny Rand",
  "Frank Castle",
  "Peter Quill",
  "Gamora Zen",
  "Drax Destroyer",
  "Groot Wood",
  "Rocket Raccoon",
  "Jane Foster",
  "Nick Fury",
  "Maria Hill",
  "Phil Coulson",
  "Melinda May",
  "Daisy Johnson"
];

const STABLE_CONDITIONS = [
  "Hypertension", "Diabetes", "Recovery", "Allergies", "Asthma", 
  "Hyperlipidemia", "Arrhythmia", "Chronic Pain", "Insomnia"
];

function getMedsForCondition(condition: string) {
  switch (condition) {
    case "Healthy": return ["Omega-3 Tablets", "Vitamin D3 1000IU"];
    case "Hypertension": return ["Amlodipine 5mg", "Lisinopril 10mg"];
    case "Diabetes": return ["Metformin 500mg"];
    case "Recovery": return ["Ibuprofen 400mg"];
    case "Allergies": return ["Claritin 10mg"];
    case "Asthma": return ["Albuterol Inhaler"];
    case "Hyperlipidemia": return ["Atorvastatin 20mg"];
    case "Arrhythmia": return ["Metoprolol 25mg"];
    case "Chronic Pain": return ["Gabapentin 100mg"];
    case "Insomnia": return ["Melatonin 5mg"];
    default: return ["Multivitamins"];
  }
}

export const INITIAL_DB = {
  users: [
    { id: "admin1", role: "admin", password: DEFAULT_PASSWORD, realName: "Eddie Architect", email: "eddie.architect@vitaltrust.com", phone: "555-0100", address: "170 West Tasman Dr, San Jose, CA 95134", clearance_level: 3, internal_notes: "Superuser level 3 access. Configures security controls for duo-oidc proxy and micro-segmentation models. High-Value administrative target." },
    { id: "admin2", role: "admin", password: DEFAULT_PASSWORD, realName: "Sarah Systems", email: "sarah.systems@vitaltrust.com", phone: "555-0101", address: "170 West Tasman Dr, San Jose, CA 95134" },
    { id: "admin3", role: "admin", password: DEFAULT_PASSWORD, realName: "David Duval", email: "david.duval@vitaltrust.com", phone: "555-0102", address: "170 West Tasman Dr, San Jose, CA 95134" },
    { id: "admin4", role: "admin", password: DEFAULT_PASSWORD, realName: "Alice Access", email: "alice.access@vitaltrust.com", phone: "555-0103", address: "170 West Tasman Dr, San Jose, CA 95134" },
    { id: "admin5", role: "admin", password: DEFAULT_PASSWORD, realName: "Wendy Workload", email: "wendy.workload@vitaltrust.com", phone: "555-0104", address: "170 West Tasman Dr, San Jose, CA 95134" },
    { id: "doctor1", role: "doctor", password: DEFAULT_PASSWORD, realName: "Gregory House", email: "g.house@hospital.com", phone: "555-0201", address: "1 Mercer St, Princeton, NJ 08540", npi_number: "1689701143" },
    { id: "doctor2", role: "doctor", password: DEFAULT_PASSWORD, realName: "Stephen Strange", email: "s.strange@sanctum.com", phone: "555-0202", address: "177A Bleecker St, New York, NY 10012" },
    { id: "doctor3", role: "doctor", password: DEFAULT_PASSWORD, realName: "Meredith Grey", email: "m.grey@hospital.com", phone: "555-0203", address: "300 Terry Ave N, Seattle, WA 98109" },
    { id: "doctor4", role: "doctor", password: DEFAULT_PASSWORD, realName: "Leonard McCoy", email: "l.mccoy@starfleet.com", phone: "555-0204", address: "1 Enterprise Way, San Francisco, CA 94105" },
    { id: "doctor5", role: "doctor", password: DEFAULT_PASSWORD, realName: "Beverly Crusher", email: "b.crusher@starfleet.com", phone: "555-0205", address: "100 Starfleet Plaza, San Francisco, CA 94111" },
    { id: "doctor6", role: "doctor", password: DEFAULT_PASSWORD, realName: "Doogie Howser", email: "d.howser@hospital.com", phone: "555-0206", address: "550 S Hope St, Los Angeles, CA 90071" },
    { id: "doctor7", role: "doctor", password: DEFAULT_PASSWORD, realName: "James Wilson", email: "j.wilson@hospital.com", phone: "555-0207", address: "1 Mercer St, Princeton, NJ 08540" },
    { id: "doctor8", role: "doctor", password: DEFAULT_PASSWORD, realName: "Hannibal Lecter", email: "h.lecter@hospital.com", phone: "555-0208", address: "100 Constitution Ave, Baltimore, MD 21202" },
    { id: "doctor9", role: "doctor", password: DEFAULT_PASSWORD, realName: "John Watson", email: "j.watson@london.uk", phone: "555-0209", address: "221B Baker St, London, NW1 6XE" },
    { id: "doctor10", role: "doctor", password: DEFAULT_PASSWORD, realName: "Ken Jeong", email: "k.jeong@comedy.com", phone: "555-0210", address: "6801 Hollywood Blvd, Hollywood, CA 90028" },
    { id: "nurse1", role: "nurse", password: DEFAULT_PASSWORD, realName: "Nurse Ratched", email: "m.ratched@vitaltrust.com", phone: "555-0301", address: "2600 Center St NE, Salem, OR 97301", assigned_ward: "Mental Health Residence - Ward B" },
    { id: "nurse2", role: "nurse", password: DEFAULT_PASSWORD, realName: "Abby Lockhart", email: "a.lockhart@vitaltrust.com", phone: "555-0302", address: "1901 W Harrison St, Chicago, IL 60612" },
    { id: "nurse3", role: "nurse", password: DEFAULT_PASSWORD, realName: "Jackie Peyton", email: "j.peyton@vitaltrust.com", phone: "555-0303", address: "421 E 14th St, New York, NY 10009" },
    { id: "nurse4", role: "nurse", password: DEFAULT_PASSWORD, realName: "Nurse Joy", email: "joy@vitaltrust.com", phone: "555-0304", address: "1 Main St, Pallet Town, Kanto 00001" },
    { id: "nurse5", role: "nurse", password: DEFAULT_PASSWORD, realName: "Nurse Carol Hathaway", email: "c.hathaway@vitaltrust.com", phone: "555-0305", address: "1901 W Harrison St, Chicago, IL 60612" },
    { id: "nurse6", role: "nurse", password: DEFAULT_PASSWORD, realName: "Nurse Christine Chapel", email: "c.chapel@starfleet.com", phone: "555-0306", address: "1 Enterprise Way, San Francisco, CA 94105" },
    { id: "nurse7", role: "nurse", password: DEFAULT_PASSWORD, realName: "Nurse Carla Espinosa", email: "c.espinosa@hospital.com", phone: "555-0307", address: "Sacred Heart, Los Angeles, CA 90026" },
    { id: "nurse8", role: "nurse", password: DEFAULT_PASSWORD, realName: "Nurse Trixie Franklin", email: "t.franklin@midwives.uk", phone: "555-0308", address: "Nonnatus House, London, UK" },
    { id: "nurse9", role: "nurse", password: DEFAULT_PASSWORD, realName: "Nurse Julia Ogden", email: "j.ogden@toronto.ca", phone: "555-0309", address: "Toronto Station #4, Toronto, ON" },
    { id: "nurse10", role: "nurse", password: DEFAULT_PASSWORD, realName: "Nurse Margaret Houlihan", email: "m.houlihan@army.mil", phone: "555-0310", address: "MASH 4077, South Korea" },
    { id: "patient1", role: "patient", password: DEFAULT_PASSWORD, realName: "Sarah Smith", email: "sarah@ex.com", phone: "555-0101", address: "742 Evergreen Terrace, Springfield, OR 97477" },
    { id: "patient2", role: "patient", password: DEFAULT_PASSWORD, realName: "John Doe", email: "john@ex.com", phone: "555-0102", address: "123 Maple St, Anycity, OH 43210" },
    { id: "patient3", role: "patient", password: DEFAULT_PASSWORD, realName: "Robert Ross", email: "bob@ex.com", phone: "555-0103", address: "1007 Mountain Drive, Gotham, NJ 07001" },
    { id: "patient4", role: "patient", password: DEFAULT_PASSWORD, realName: "Emma Watson", email: "emma@ex.com", phone: "555-0104", address: "Platform 9 3/4, London, UK NW1 2AL" },
    { id: "patient5", role: "patient", password: DEFAULT_PASSWORD, realName: "Bruce Wayne", email: "bruce@wayne.com", phone: "555-0105", address: "1007 Mountain Drive, Gotham, NJ 07001" },
    { id: "patient6", role: "patient", password: DEFAULT_PASSWORD, realName: "Clark Kent", email: "clark@kent.com", phone: "555-0106", address: "344 Clinton St, Metropolis, NY 10001" },
    { id: "patient7", role: "patient", password: DEFAULT_PASSWORD, realName: "Diana Prince", email: "diana@amazon.com", phone: "555-0107", address: "1 Paradise Island Way, Themyscira, GR 85100" },
    { id: "patient8", role: "patient", password: DEFAULT_PASSWORD, realName: "Peter Parker", email: "peter@pub.com", phone: "555-0108", address: "20 Ingram St, Queens, NY 11375" },
    { id: "patient9", role: "patient", password: DEFAULT_PASSWORD, realName: "Tony Stark", email: "tony@stark.com", phone: "555-0109", address: "10880 Wilshire Blvd, Malibu, CA 90265" },
    { id: "patient10", role: "patient", password: DEFAULT_PASSWORD, realName: "Steve Rogers", email: "cap@usa.gov", phone: "555-0110", address: "569 Lefferts Ave, Brooklyn, NY 11203" },
    { id: "patient11", role: "patient", password: DEFAULT_PASSWORD, realName: "Natasha Romanoff", email: "nat@spy.gov", phone: "555-0111", address: "100 Broadway, New York, NY 10005" },
    { id: "patient12", role: "patient", password: DEFAULT_PASSWORD, realName: "Thor Odinson", email: "thor@asgard.com", phone: "555-0112", address: "1 Asgardian Way, Tromsø, NO 9008" },
    { id: "patient13", role: "patient", password: DEFAULT_PASSWORD, realName: "Wanda Maximoff", email: "wanda@magic.com", phone: "555-0113", address: "2800 Sherwood Terrace, Westview, NJ 07001" },
    { id: "patient14", role: "patient", password: DEFAULT_PASSWORD, realName: "Vision", email: "viz@bot.com", phone: "555-0114", address: "2800 Sherwood Terrace, Westview, NJ 07001" },
    { id: "patient15", role: "patient", password: DEFAULT_PASSWORD, realName: "Sam Wilson", email: "sam@falcon.com", phone: "555-0115", address: "1600 Pennsylvania Ave NW, Washington, DC 20500" },
    { id: "patient16", role: "patient", password: DEFAULT_PASSWORD, realName: "Bucky Barnes", email: "bucky@soldier.com", phone: "555-0116", address: "569 Lefferts Ave, Brooklyn, NY 11203" },
    { id: "patient17", role: "patient", password: DEFAULT_PASSWORD, realName: "Scott Lang", email: "scott@ant.com", phone: "555-0117", address: "3711 22nd St, San Francisco, CA 94114" },
    { id: "patient18", role: "patient", password: DEFAULT_PASSWORD, realName: "Hope Pym", email: "hope@wasp.com", phone: "555-0118", address: "100 Pym Tech Plaza, San Francisco, CA 94107" },
    { id: "patient19", role: "patient", password: DEFAULT_PASSWORD, realName: "T'Challa", email: "king@wakanda.com", phone: "555-0119", address: "1 Palace Grounds, Birnin Zana, WK 00001" },
    { id: "patient20", role: "patient", password: DEFAULT_PASSWORD, realName: "Carol Danvers", email: "carol@marvel.com", phone: "555-0120", address: "1 Space Station Blvd, Orbit, Earth 00000" },
    // Dynamically added patients 21 to 50
    ...(function() {
      const extra = [];
      for (let i = 21; i <= 50; i++) {
        const name = EXTRA_PATIENT_NAMES[i - 21];
        const email = name.toLowerCase().replace(/\s+/g, '') + "@ex.com";
        extra.push({
          id: `patient${i}`,
          role: "patient",
          password: DEFAULT_PASSWORD,
          realName: name,
          email: email,
          phone: `555-01${20 + i}`,
          address: `${100 + i} Main St, Springfield`
        });
      }
      return extra;
    })()
  ],
  patients: [
    { id: "patient1", name: "Sarah Smith", dob: "1992-08-20", ssn: "999-22-1111", insurance_id: "AET-3211421", phone: "555-0101", address: "742 Evergreen Terrace, Springfield, OR 97477", email: "sarah@ex.com", condition: "Hypertension", medications: ["Amlodipine 5mg"], lastVisit: "2024-02-15", assignedDoctorId: "doctor1", assignedNurseId: "nurse1", status: "active" },
    { id: "patient2", name: "John Doe", dob: "1985-05-12", ssn: "555-01-4321", insurance_id: "BCBS-8812739", phone: "555-0102", address: "123 Maple St, Anycity, OH 43210", email: "john@ex.com", condition: "Diabetes", medications: ["Metformin 500mg"], lastVisit: "2024-03-10", assignedDoctorId: "doctor2", assignedNurseId: "nurse2", status: "active" },
    { id: "patient3", name: "Robert Ross", dob: "1970-12-01", ssn: "999-44-3333", insurance_id: "CIG-9481231", phone: "555-0103", address: "1007 Mountain Drive, Gotham, NJ 07001", email: "bob@ex.com", condition: "Recovery", medications: ["Ibuprofen 400mg"], lastVisit: "2024-04-01", assignedDoctorId: "doctor1", assignedNurseId: "nurse1", status: "active" },
    { id: "patient4", name: "Emma Watson", dob: "1990-04-15", ssn: "999-55-4444", phone: "555-0104", address: "Platform 9 3/4, London, UK NW1 2AL", email: "emma@ex.com", condition: "Allergies", medications: ["Claritin 10mg"], lastVisit: "2024-03-22", assignedDoctorId: "doctor3", assignedNurseId: "nurse2", status: "active" },
    { id: "patient5", name: "Bruce Wayne", dob: "1980-02-19", ssn: "999-66-5555", phone: "555-0105", address: "1007 Mountain Drive, Gotham, NJ 07001", email: "bruce@wayne.com", condition: "Healthy", medications: ["Vitamins"], lastVisit: "2024-04-10", assignedDoctorId: "doctor4", assignedNurseId: "nurse3", status: "active" },
    { id: "patient6", name: "Clark Kent", dob: "1978-06-18", ssn: "999-77-6666", phone: "555-0106", address: "344 Clinton St, Metropolis, NY 10001", email: "clark@kent.com", condition: "Healthy", medications: ["Sun Exposure Therapy"], lastVisit: "2024-01-15", assignedDoctorId: "doctor5", assignedNurseId: "nurse3", status: "active" },
    { id: "patient7", name: "Diana Prince", dob: "1918-01-01", ssn: "999-88-7777", phone: "555-0107", address: "1 Paradise Island Way, Themyscira, GR 85100", email: "diana@amazon.com", condition: "Healthy", medications: ["Amrosia 5mg"], lastVisit: "2024-02-20", assignedDoctorId: "doctor6", assignedNurseId: "nurse4", status: "active" },
    { id: "patient8", name: "Peter Parker", dob: "2001-08-10", ssn: "999-99-8888", phone: "555-0108", address: "20 Ingram St, Queens, NY 11375", email: "peter@pub.com", condition: "Healthy", medications: ["Zinc Supplement 50mg"], lastVisit: "2024-04-05", assignedDoctorId: "doctor7", assignedNurseId: "nurse4", status: "active" },
    { id: "patient9", name: "Tony Stark", dob: "1970-05-29", ssn: "999-00-9999", phone: "555-0109", address: "10880 Wilshire Blvd, Malibu, CA 90265", email: "tony@stark.com", condition: "Healthy", medications: ["Iron Supplement"], lastVisit: "2024-03-15", assignedDoctorId: "doctor8", assignedNurseId: "nurse5", status: "active" },
    { id: "patient10", name: "Steve Rogers", dob: "1918-07-04", ssn: "999-11-0000", phone: "555-0110", address: "569 Lefferts Ave, Brooklyn, NY 11203", email: "cap@usa.gov", condition: "Healthy", medications: ["Serum Monitoring"], lastVisit: "2024-04-12", assignedDoctorId: "doctor9", assignedNurseId: "nurse5", status: "active" },
    { id: "patient11", name: "Natasha Romanoff", dob: "1984-11-22", ssn: "999-22-1111", phone: "555-0111", address: "100 Broadway, New York, NY 10005", email: "nat@spy.gov", condition: "Healthy", medications: ["B12 1000mcg"], lastVisit: "2024-03-01", assignedDoctorId: "doctor10", assignedNurseId: "nurse6", status: "active" },
    { id: "patient12", name: "Thor Odinson", dob: "0964-01-01", ssn: "999-33-2222", phone: "555-0112", address: "1 Asgardian Way, Tromsø, NO 9008", email: "thor@asgard.com", condition: "Healthy", medications: ["Electrolytes"], lastVisit: "2024-02-14", assignedDoctorId: "doctor1", assignedNurseId: "nurse6", status: "active" },
    { id: "patient13", name: "Wanda Maximoff", dob: "1989-02-10", ssn: "999-44-3333", phone: "555-0113", address: "2800 Sherwood Terrace, Westview, NJ 07001", email: "wanda@magic.com", condition: "Healthy", medications: ["CalmDown 10mg"], lastVisit: "2024-04-18", assignedDoctorId: "doctor2", assignedNurseId: "nurse7", status: "active" },
    { id: "patient14", name: "Vision", dob: "2015-05-05", ssn: "999-55-4444", phone: "555-0114", address: "2800 Sherwood Terrace, Westview, NJ 07001", email: "viz@bot.com", condition: "Healthy", medications: ["System Patch 2.1"], lastVisit: "2024-04-18", assignedDoctorId: "doctor3", assignedNurseId: "nurse7", status: "active" },
    { id: "patient15", name: "Sam Wilson", dob: "1978-04-14", ssn: "999-66-5555", phone: "555-0115", address: "1600 Pennsylvania Ave NW, Washington, DC 20500", email: "sam@falcon.com", condition: "Healthy", medications: ["Joint Support"], lastVisit: "2024-03-25", assignedDoctorId: "doctor4", assignedNurseId: "nurse8", status: "active" },
    { id: "patient16", name: "Bucky Barnes", dob: "1917-03-10", ssn: "999-77-6666", phone: "555-0116", address: "569 Lefferts Ave, Brooklyn, NY 11203", email: "bucky@soldier.com", condition: "Healthy", medications: ["Omega-3"], lastVisit: "2024-04-02", assignedDoctorId: "doctor5", assignedNurseId: "nurse8", status: "active" },
    { id: "patient17", name: "Scott Lang", dob: "1969-04-06", ssn: "999-88-7777", phone: "555-0117", address: "3711 22nd St, San Francisco, CA 94114", email: "scott@ant.com", condition: "Healthy", medications: ["Protein 25g"], lastVisit: "2024-03-30", assignedDoctorId: "doctor6", assignedNurseId: "nurse9", status: "active" },
    { id: "patient18", name: "Hope Pym", dob: "1979-01-01", ssn: "999-99-8888", phone: "555-0118", address: "100 Pym Tech Plaza, San Francisco, CA 94107", email: "hope@wasp.com", condition: "Healthy", medications: ["Multivitamin"], lastVisit: "2024-03-30", assignedDoctorId: "doctor7", assignedNurseId: "nurse9", status: "active" },
    { id: "patient19", name: "T'Challa", dob: "1980-11-24", ssn: "999-00-9999", phone: "555-0119", address: "1 Palace Grounds, Birnin Zana, WK 00001", email: "king@wakanda.com", condition: "Healthy", medications: ["Heart-Shaped Herb"], lastVisit: "2024-04-20", assignedDoctorId: "doctor8", assignedNurseId: "nurse10", status: "active" },
    { id: "patient20", name: "Carol Danvers", dob: "1960-10-21", ssn: "999-11-0000", phone: "555-0120", address: "1 Space Station Blvd, Orbit, Earth 00000", email: "carol@marvel.com", condition: "Healthy", medications: ["Energy Bars"], lastVisit: "2024-04-15", assignedDoctorId: "doctor9", assignedNurseId: "nurse10", status: "active" },
    // Dynamically added patients 21 to 50
    ...(function() {
      const extra = [];
      for (let i = 21; i <= 50; i++) {
        const name = EXTRA_PATIENT_NAMES[i - 21];
        const email = name.toLowerCase().replace(/\s+/g, '') + "@ex.com";
        extra.push({
          id: `patient${i}`,
          name: name,
          dob: `${1980 + (i % 20)}-05-${(10 + (i % 15))}`,
          ssn: `999-55-${1000 + i}`,
          insurance_id: `BCBS-${3211000 + i * 77}`,
          phone: `555-01${20 + i}`,
          address: `${100 + i} Main St, Springfield`,
          email: email,
          status: "active"
        });
      }
      return extra;
    })()
  ],
  nurses: [
    { id: "nurse1", name: "Nurse Ratched" },
    { id: "nurse2", name: "Nurse Abby Lockhart" },
    { id: "nurse3", name: "Nurse Jackie Peyton" },
    { id: "nurse4", name: "Nurse Joy" },
    { id: "nurse5", name: "Nurse Carol Hathaway" },
    { id: "nurse6", name: "Nurse Christine Chapel" },
    { id: "nurse7", name: "Nurse Carla Espinosa" },
    { id: "nurse8", name: "Nurse Trixie Franklin" },
    { id: "nurse9", name: "Nurse Julia Ogden" },
    { id: "nurse10", name: "Nurse Margaret Houlihan" },
  ],
  doctors: [
    { id: "doctor1", name: "Dr. Gregory House" },
    { id: "doctor2", name: "Dr. Stephen Strange" },
    { id: "doctor3", name: "Dr. Meredith Grey" },
    { id: "doctor4", name: "Dr. Leonard McCoy" },
    { id: "doctor5", name: "Dr. Beverly Crusher" },
    { id: "doctor6", name: "Dr. Doogie Howser" },
    { id: "doctor7", name: "Dr. James Wilson" },
    { id: "doctor8", name: "Dr. Hannibal Lecter" },
    { id: "doctor9", name: "Dr. John Watson" },
    { id: "doctor10", name: "Dr. Ken Jeong" },
  ],
  appointments: [
    ...(function() {
      const apts = [];
      for (let i = 1; i <= 50; i++) {
        const patientId = `patient${i}`;
        const numApts = Math.floor(Math.random() * 3) + 1; // 1-3
        for (let j = 0; j < numApts; j++) {
            apts.push({
                id: `apt_${patientId}_${j}`,
                patientId: patientId,
                doctorId: `doctor${(i % 10) + 1}`,
                date: `2026-08-${10 + Math.floor(Math.random() * 20)}`,
                time: `${9 + Math.floor(Math.random() * 8)}:00 AM`,
                reason: ["Consultation", "Follow-up", "Annual Physical", "Specific Issue Check"][Math.floor(Math.random() * 4)],
                status: "confirmed"
            });
        }
      }
      return apts;
    })()
  ],
  lab_results: [
    ...(function() {
        const labs = [];
        for (let i = 1; i <= 50; i++) {
          const patientId = `patient${i}`;
          const numLabs = Math.floor(Math.random() * 5) + 1; // 1-5
          for (let j = 0; j < numLabs; j++) {
              labs.push({
                  id: `lab_${patientId}_${j}`,
                  patientId: patientId,
                  testName: ["Complete Blood Count", "Lipid Panel", "HbA1c", "Metabolic Panel", "Imaging"][Math.floor(Math.random() * 5)],
                  date: `2026-07-${10 + Math.floor(Math.random() * 20)}`,
                  result: ["Normal", "Stable", "Borderline", "Requires Review"][Math.floor(Math.random() * 4)],
                  notes: "Result recorded in Clinical portal."
              });
          }
        }
        return labs;
      })()
  ],
  billing: [
    ...(function() {
        const bills = [];
        for (let i = 1; i <= 50; i++) {
          const patientId = `patient${i}`;
          const numBills = Math.floor(Math.random() * 10); // 0-10
          for (let j = 0; j < numBills; j++) {
              bills.push({
                  id: `bill_${patientId}_${j}`,
                  patientId: patientId,
                  date: `2026-06-${10 + Math.floor(Math.random() * 20)}`,
                  description: ["Consultation Fee", "Lab Processing", "Administrative Fee", "Pharmacy Component"][Math.floor(Math.random() * 4)],
                  amount: 50 + Math.floor(Math.random() * 250),
                  status: ["paid", "unpaid", "pending"][Math.floor(Math.random() * 3)]
              });
          }
        }
        return bills;
      })()
  ],
  medications_detailed: [
    ...(function() {
        const meds = [];
        const drugNames = ["Amlodipine", "Metformin", "Lisinopril", "Atorvastatin", "Levothyroxine", "Albuterol", "Ibuprofen", "Gabapentin", "Omeprazole", "Furosemide"];
        const dosages = ["5mg", "10mg", "20mg", "40mg", "50mg", "100mg", "500mg"];
        
        for (let i = 1; i <= 50; i++) {
          const patientId = `patient${i}`;
          const numMeds = Math.floor(Math.random() * 4) + 1; // 1-4 unique meds per patient
          
          const shuffled = [...drugNames].sort(() => 0.5 - Math.random());
          const selected = shuffled.slice(0, numMeds);
          
          for (let j = 0; j < selected.length; j++) {
              meds.push({
                  id: `med_${patientId}_${j}`,
                  patientId: patientId,
                  name: selected[j],
                  dosage: dosages[Math.floor(Math.random() * dosages.length)],
                  frequency: ["Once daily", "Twice daily", "As needed"][Math.floor(Math.random() * 3)],
                  startDate: `2026-01-01`,
                  status: "pending"
              });
          }
        }
        return meds;
      })()
  ],
  messages: [
    ...(function() {
        const msgs = [];
        for (let i = 1; i <= 50; i++) {
          const patientId = `patient${i}`;
          const numMsgs = Math.floor(Math.random() * 8) + 3; // 3-10
          for (let j = 0; j < numMsgs; j++) {
              const isPatientSender = Math.random() > 0.5;
              msgs.push({
                  id: `msg_${patientId}_${j}`,
                  senderId: isPatientSender ? patientId : `doctor${(i % 10) + 1}`,
                  receiverId: isPatientSender ? `doctor${(i % 10) + 1}` : patientId,
                  content: isPatientSender ? "I have a question about my medication." : "Your latest lab results look stable. See you at your next appointment.",
                  timestamp: `2026-08-10T10:00:00Z`
              });
          }
        }
        return msgs;
      })()
    ],
    logs: [
      { 
        id: "log_init", 
        timestamp: new Date().toISOString(), 
        userId: "system", 
        userName: "System", 
        role: "system", 
        activity: "Database Initialized", 
        status: "Success", 
        details: "VitalTrust distributed healthcare portal backend initialized successfully.",
        nodeRole: "standalone"
      }
    ]
  };

// Post-Initialize INITIAL_DB to ensure all records have beautiful simulated sensitive PII / high-value data & formatted contact numbers
function formatTenDigitPhone(phone: string, index: number): string {
  const cleaned = (phone || "").replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  // Generate deterministic US phone number format: XXX-XXX-XXXX
  const areaNo = (201 + (index * 13) % 700).toString().padStart(3, '0');
  const exch = (301 + (index * 7) % 600).toString().padStart(3, '0');
  const line = (1000 + (index * 19) % 8999).toString().padStart(4, '0');
  return `${areaNo}-${exch}-${line}`;
}

// First, format user phone numbers
INITIAL_DB.users.forEach((user: any, index: number) => {
  user.phone = formatTenDigitPhone(user.phone || "", index);
});

INITIAL_DB.patients.forEach((patient: any, index: number) => {
  const patientNum = index + 1;

  // Align conditions to all patients randomly, with roughly 40% target as Healthy
  // Let's use deterministic index-based assignment for exact 40% distribution (i.e. patientNum modulo 5 of 0 or 2)
  if (patientNum % 5 === 0 || patientNum % 5 === 2) {
    patient.condition = "Healthy";
  } else {
    patient.condition = STABLE_CONDITIONS[(patientNum - 1) % STABLE_CONDITIONS.length];
  }

  // Update medications matching the patient condition
  patient.medications = getMedsForCondition(patient.condition);

  // Give valid vitals metrics to ALL patients
  patient.vitals = {
    hr: (68 + (patientNum % 15)).toString(), // HR standard RESTING [68-83]
    temp: (97.7 + (patientNum % 12) * 0.1).toFixed(1), // Temp standard [97.7 - 98.9]
    bp: `${115 + (patientNum % 13)}/${74 + (patientNum % 9)}`, // BP [115-127/74-82]
    lastUpdated: "2026-05-28"
  };

  // Ensure Doctor and Nurse care team elements are correctly filled
  patient.assignedDoctorId = `doctor${((patientNum - 1) % 10) + 1}`;
  patient.assignedNurseId = `nurse${(((patientNum + 2) % 10) + 1)}`;

  const matchUser = INITIAL_DB.users.find((u: any) => u.id === patient.id);
  if (matchUser) {
    patient.phone = matchUser.phone;
  } else {
    patient.phone = formatTenDigitPhone(patient.phone || "", index + 100);
  }

  if (!patient.ssn) {
    patient.ssn = `999-55-${1000 + patientNum}`;
  }
  if (!patient.insurance_id) {
    const providers = ["BCBS", "AET", "CIG", "UNI", "HUM"];
    const prov = providers[index % providers.length];
    patient.insurance_id = `${prov}-${3211000 + patientNum * 77}`;
  }
  if (!patient.clinical_notes || patient.clinical_notes.trim() === "" || patient.clinical_notes.includes("routine checkup")) {
    patient.clinical_notes = `Patient is currently being monitored for ${patient.condition}. The recorded treatment plan consists of physical observation and active prescription management: ${patient.medications.join(', ')}. Responding well to therapy. High-value clinical monitoring target.`;
  }
});

// Also ensure all patient users have ssn, insurance_id, clinical_notes matching their clinical patient record
INITIAL_DB.users.forEach((user: any, index: number) => {
  if (user.role === 'admin') {
    if (user.clearance_level === undefined) {
      user.clearance_level = (index % 3) + 1;
    }
    if (!user.internal_notes) {
      user.internal_notes = `Superuser level ${user.clearance_level} access. Handles operational compliance and role mappings for duo-oidc federation. Fully authorized administrative profile for ${user.realName}.`;
    }
  } else if (user.role === 'doctor') {
    if (!user.npi_number) {
      user.npi_number = `${1689701000 + index * 123}`;
    }
    if (!user.internal_notes) {
      user.internal_notes = `Credentialed specialist doctor. Professional licensing active, NPI directory checked. Chief attending notes verified for ${user.realName}. Registered location: ${user.address}.`;
    }
  } else if (user.role === 'nurse') {
    if (!user.assigned_ward) {
      const wards = ["Emergency Room", "Mental Health Residence - Ward B", "Cardiac ICU", "Surgical Ward", "Pediatric Wing"];
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
      user.clinical_notes = `Routine clinical assessment. Stable diagnostic values.`;
    }
  }
});

export const db_mock = JSON.parse(JSON.stringify(INITIAL_DB));
