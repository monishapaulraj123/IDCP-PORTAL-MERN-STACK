// Seeds the SQLite database with realistic sample data (same entities the
// frontend previously hard-coded in src/data/sampleData.js) plus one test
// login account per role. Run with: npm run seed  (or npm run seed:fresh
// to wipe existing data first).
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { db, runMigrations } from './index.js'

const FRESH = process.argv.includes('--fresh')

if (FRESH) {
  db.exec(`
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS appointments;
    DROP TABLE IF EXISTS quotations;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS materials;
    DROP TABLE IF EXISTS suppliers;
    DROP TABLE IF EXISTS contractors;
    DROP TABLE IF EXISTS designers;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS users;
  `)
}

runMigrations()

const alreadySeeded = db.prepare('SELECT COUNT(*) AS n FROM customers').get().n > 0
if (alreadySeeded && !FRESH) {
  console.log('Database already has data — skipping seed. Use "npm run seed:fresh" to reset.')
  process.exit(0)
}

const insertCustomer = db.prepare(`
  INSERT INTO customers (customer_code, name, email, phone, address, location, property_type, project_type, budget, start_date, end_date, requirements, designer, contractor, status)
  VALUES (@customer_code, @name, @email, @phone, @address, @location, @property_type, @project_type, @budget, @start_date, @end_date, @requirements, @designer, @contractor, @status)
`)

const CUSTOMERS = [
  { customer_code: 'CUS-1001', name: 'Priya Mehta', email: 'priya.mehta@example.com', phone: '+91 98200 11001', address: '14 Marine Drive, Colaba', location: 'Mumbai', property_type: 'Penthouse', project_type: 'Luxury Residential', budget: 4800000, start_date: '2026-06-15', end_date: '2026-07-28', requirements: 'Full penthouse renovation with a warm, luxury palette, custom joinery and a home theatre corner.', designer: 'Sneha Patel', contractor: 'Apex Constructions', status: 'Active' },
  { customer_code: 'CUS-1002', name: 'Rahul Sharma', email: 'rahul.sharma@example.com', phone: '+91 98200 11002', address: '22 Carter Road, Bandra West', location: 'Mumbai', property_type: 'Villa', project_type: 'Modern Villa', budget: 3200000, start_date: '2026-07-01', end_date: '2026-08-18', requirements: 'Complete villa redo — modern minimalist interiors, open kitchen and a landscaped courtyard.', designer: 'Arjun Kumar', contractor: 'BuildWell Interiors', status: 'Active' },
  { customer_code: 'CUS-1003', name: 'Meera Joshi', email: 'meera.joshi@example.com', phone: '+91 98450 11003', address: '5th Floor, MG Road', location: 'Bengaluru', property_type: 'Commercial Office', project_type: 'Commercial', budget: 1850000, start_date: '2026-06-10', end_date: '2026-08-05', requirements: 'Modern office interior with collaborative work zones, meeting pods and branded reception.', designer: 'Ananya Rao', contractor: 'UrbanCraft Works', status: 'Active' },
  { customer_code: 'CUS-1004', name: 'Kavya Nair', email: 'kavya.nair@example.com', phone: '+91 98840 11004', address: '3 Marina Enclave, ECR', location: 'Chennai', property_type: 'Apartment', project_type: 'Residential', budget: 2400000, start_date: '2026-05-05', end_date: '2026-06-20', requirements: 'Coastal-themed apartment interiors with light woods and breezy fabrics.', designer: 'Rahul Verma', contractor: 'Coastal Build Co.', status: 'Completed' },
  { customer_code: 'CUS-1005', name: 'Aditya Shah', email: 'aditya.shah@example.com', phone: '+91 98450 11005', address: '12 Hillview Society', location: 'Pune', property_type: 'Residential Bungalow', project_type: 'Residential', budget: 5600000, start_date: '2026-06-20', end_date: '2026-09-30', requirements: 'Full bungalow interior design across four bedrooms with a dedicated study and terrace lounge.', designer: 'Sneha Patel', contractor: 'Apex Constructions', status: 'Active' },
  { customer_code: 'CUS-1006', name: 'Neha Gupta', email: 'neha.gupta@example.com', phone: '+91 98450 11006', address: 'Lakeside Residency, Sector 21', location: 'Delhi', property_type: 'Apartment', project_type: 'Modular Kitchen', budget: 2100000, start_date: '2026-04-01', end_date: '2026-06-15', requirements: 'Modular kitchen suite upgrade with island seating and smart storage.', designer: 'Arjun Kumar', contractor: 'BuildWell Interiors', status: 'Active' },
  { customer_code: 'CUS-1007', name: 'Divya Menon', email: 'divya.menon@example.com', phone: '+91 97460 55667', address: 'MG Road Business Park', location: 'Kochi', property_type: 'Boutique Office', project_type: 'Commercial', budget: 1200000, start_date: '2026-03-05', end_date: '2026-09-01', requirements: 'Boutique studio office fit-out, currently paused pending revised budget approval.', designer: 'Ananya Rao', contractor: 'UrbanCraft Works', status: 'Inactive' },
  { customer_code: 'CUS-1008', name: 'Vikram Singh', email: 'vikram.singh@example.com', phone: '+91 98450 88990', address: 'Green Acres Farmhouse', location: 'Coimbatore', property_type: 'Farmhouse', project_type: 'Villa', budget: 3600000, start_date: '2025-06-15', end_date: '2025-09-30', requirements: 'Farmhouse interiors with rustic wood finishes and an outdoor dining deck.', designer: 'Rahul Verma', contractor: 'Coastal Build Co.', status: 'Completed' },
  { customer_code: 'CUS-1009', name: 'Ananya Iyer', email: 'ananya.iyer@example.com', phone: '+91 89390 66778', address: '9 Skyline Towers', location: 'Bengaluru', property_type: 'Penthouse', project_type: 'Residential', budget: 2800000, start_date: '2026-07-20', end_date: '2026-11-10', requirements: 'Penthouse makeover with an emphasis on natural light and a curated art wall.', designer: 'Sneha Patel', contractor: 'Apex Constructions', status: 'Active' }
]
const customerIds = CUSTOMERS.map((c) => insertCustomer.run(c).lastInsertRowid)

const insertDesigner = db.prepare(`
  INSERT INTO designers (designer_code, name, specialization, experience, availability, rating, active_projects, phone, email)
  VALUES (@designer_code, @name, @specialization, @experience, @availability, @rating, @active_projects, @phone, @email)
`)
const DESIGNERS = [
  { designer_code: 'DSG-1024', name: 'Ananya Rao', specialization: 'Modern Interior Specialist', experience: '8 Years', availability: 'Available', rating: 4.9, active_projects: 4, phone: '+91 98450 11024', email: 'ananya.rao@idcp.com' },
  { designer_code: 'DSG-1031', name: 'Arjun Kumar', specialization: 'Luxury Design Expert', experience: '12 Years', availability: 'Busy', rating: 4.8, active_projects: 6, phone: '+91 98450 11031', email: 'arjun.kumar@idcp.com' },
  { designer_code: 'DSG-1047', name: 'Sneha Patel', specialization: 'Scandinavian Designer', experience: '6 Years', availability: 'Available', rating: 4.7, active_projects: 3, phone: '+91 98450 11047', email: 'sneha.patel@idcp.com' },
  { designer_code: 'DSG-1052', name: 'Rahul Verma', specialization: 'Commercial Designer', experience: '10 Years', availability: 'Busy', rating: 4.6, active_projects: 5, phone: '+91 98450 11052', email: 'rahul.verma@idcp.com' }
]
DESIGNERS.forEach((d) => insertDesigner.run(d))

const insertContractor = db.prepare(`
  INSERT INTO contractors (contractor_code, name, contact_person, specialization, status, experience, rating, phone, email, current_project)
  VALUES (@contractor_code, @name, @contact_person, @specialization, @status, @experience, @rating, @phone, @email, @current_project)
`)
const CONTRACTORS = [
  { contractor_code: 'CTR-4501', name: 'Apex Constructions', contact_person: 'Mahesh Iyer', specialization: 'Civil & Carpentry', status: 'Active', experience: '14 Years', rating: 4.8, phone: '+91 98230 45011', email: 'contact@apexconstructions.com', current_project: 'Skyline Penthouse' },
  { contractor_code: 'CTR-4502', name: 'BuildWell Interiors', contact_person: 'Priya Nair', specialization: 'Electrical & Fit-out', status: 'Active', experience: '9 Years', rating: 4.6, phone: '+91 98230 45022', email: 'contact@buildwellinteriors.com', current_project: 'Bandra Villa Redo' },
  { contractor_code: 'CTR-4503', name: 'UrbanCraft Works', contact_person: 'Sameer Khan', specialization: 'Commercial Fit-out', status: 'On Hold', experience: '11 Years', rating: 4.5, phone: '+91 98230 45033', email: 'contact@urbancraftworks.com', current_project: 'Modern Office Interior' },
  { contractor_code: 'CTR-4504', name: 'Coastal Build Co.', contact_person: 'Deepa Menon', specialization: 'Residential Construction', status: 'Active', experience: '7 Years', rating: 4.7, phone: '+91 98230 45044', email: 'contact@coastalbuildco.com', current_project: 'Coastal Apartment' }
]
CONTRACTORS.forEach((c) => insertContractor.run(c))

const insertSupplier = db.prepare(`
  INSERT INTO suppliers (supplier_code, name, category, contact_person, rating, phone, email, delivery_status, materials_supplied)
  VALUES (@supplier_code, @name, @category, @contact_person, @rating, @phone, @email, @delivery_status, @materials_supplied)
`)
const SUPPLIERS = [
  { supplier_code: 'SUP-6501', name: 'StoneCraft Materials', category: 'Marble & Natural Stone', contact_person: 'Rohit Bhatia', rating: 4.8, phone: '+91 98765 65120', email: 'sales@stonecraft.com', delivery_status: 'On Time', materials_supplied: JSON.stringify(['Italian Marble', 'Granite', 'Quartz']) },
  { supplier_code: 'SUP-6502', name: 'Woodline Interiors', category: 'Wood & Flooring', contact_person: 'Anil Kumar', rating: 4.7, phone: '+91 98765 65121', email: 'sales@woodline.com', delivery_status: 'In Transit', materials_supplied: JSON.stringify(['Oak', 'Teak', 'Engineered Wood']) },
  { supplier_code: 'SUP-6503', name: 'Luma Lighting Studio', category: 'Lighting', contact_person: 'Farah Sheikh', rating: 4.9, phone: '+91 98765 65122', email: 'hello@lumalighting.com', delivery_status: 'Delivered', materials_supplied: JSON.stringify(['Pendant Lights', 'Chandeliers', 'LED Fixtures']) },
  { supplier_code: 'SUP-6504', name: 'TileHaus Studio', category: 'Tiles & Surfaces', contact_person: 'Vivek Rao', rating: 4.6, phone: '+91 98765 65123', email: 'sales@tilehaus.com', delivery_status: 'Pending', materials_supplied: JSON.stringify(['Ceramic Tiles', 'Porcelain Tiles', 'Mosaic']) },
  { supplier_code: 'SUP-6505', name: 'Elegance Fabrics', category: 'Textiles & Drapery', contact_person: 'Kiran Shah', rating: 4.7, phone: '+91 98765 65124', email: 'hello@elegancefab.com', delivery_status: 'On Time', materials_supplied: JSON.stringify(['Upholstery', 'Curtains', 'Cushions']) },
  { supplier_code: 'SUP-6506', name: 'FinesseFittings Co.', category: 'Hardware & Fixtures', contact_person: 'Nikhil Das', rating: 4.8, phone: '+91 98765 65125', email: 'sales@finessefit.com', delivery_status: 'Delivered', materials_supplied: JSON.stringify(['Brass Handles', 'Hinges', 'Locks']) }
]
SUPPLIERS.forEach((s) => insertSupplier.run(s))

const insertMaterial = db.prepare(`
  INSERT INTO materials (sku, name, category, supplier, unit_price, unit, stock, quantity_available)
  VALUES (@sku, @name, @category, @supplier, @unit_price, @unit, @stock, @quantity_available)
`)
const MATERIALS = [
  { sku: 'MAT-8801', name: 'Italian Carrara Marble', category: 'Natural Stone', supplier: 'StoneCraft Materials', unit_price: 850, unit: 'sq.ft', stock: 'In Stock', quantity_available: 1240 },
  { sku: 'MAT-8802', name: 'Natural Oak Wood', category: 'Wood & Flooring', supplier: 'Woodline Interiors', unit_price: 420, unit: 'sq.ft', stock: 'In Stock', quantity_available: 680 },
  { sku: 'MAT-8803', name: 'Modern Pendant Light', category: 'Lighting', supplier: 'Luma Lighting Studio', unit_price: 18500, unit: 'unit', stock: 'Low Stock', quantity_available: 12 },
  { sku: 'MAT-8804', name: 'Terrazzo Surface Tile', category: 'Tiles & Surfaces', supplier: 'TileHaus Studio', unit_price: 180, unit: 'sq.ft', stock: 'Out of Stock', quantity_available: 0 },
  { sku: 'MAT-8805', name: 'Velvet Accent Sofa', category: 'Furniture', supplier: 'Elegance Fabrics', unit_price: 65000, unit: 'unit', stock: 'New Arrival', quantity_available: 8 },
  { sku: 'MAT-8806', name: 'Brass Cabinet Handles', category: 'Hardware & Fixtures', supplier: 'FinesseFittings Co.', unit_price: 220, unit: 'piece', stock: 'In Stock', quantity_available: 340 }
]
MATERIALS.forEach((m) => insertMaterial.run(m))

const insertProject = db.prepare(`
  INSERT INTO projects (project_code, customer_id, name, customer_name, project_type, designer, contractor, location, budget, start_date, end_date, priority, current_stage_index, status)
  VALUES (@project_code, @customer_id, @name, @customer_name, @project_type, @designer, @contractor, @location, @budget, @start_date, @end_date, @priority, @current_stage_index, @status)
`)
const PROJECTS = [
  { project_code: 'PRJ-2601', customer_id: customerIds[0], name: 'Skyline Penthouse', customer_name: 'Priya Mehta', project_type: 'Luxury Residential', designer: 'Sneha Patel', contractor: 'Apex Constructions', location: 'Mumbai', budget: 4800000, start_date: '2026-06-15', end_date: '2026-07-28', priority: 'High', current_stage_index: 10, status: 'Ongoing' },
  { project_code: 'PRJ-2602', customer_id: customerIds[1], name: 'Bandra Villa Redo', customer_name: 'Rahul Sharma', project_type: 'Villa Interior Design', designer: 'Arjun Kumar', contractor: 'BuildWell Interiors', location: 'Mumbai', budget: 3200000, start_date: '2026-07-01', end_date: '2026-08-18', priority: 'Medium', current_stage_index: 7, status: 'Ongoing' },
  { project_code: 'PRJ-2603', customer_id: customerIds[2], name: 'Modern Office Interior', customer_name: 'Meera Joshi', project_type: 'Office Interior Design', designer: 'Ananya Rao', contractor: 'UrbanCraft Works', location: 'Bengaluru', budget: 1850000, start_date: '2026-06-10', end_date: '2026-08-05', priority: 'High', current_stage_index: 12, status: 'Ongoing' },
  { project_code: 'PRJ-2604', customer_id: customerIds[3], name: 'Coastal Apartment', customer_name: 'Kavya Nair', project_type: 'Apartment Interior Design', designer: 'Rahul Verma', contractor: 'Coastal Build Co.', location: 'Chennai', budget: 2400000, start_date: '2026-05-05', end_date: '2026-06-20', priority: 'Medium', current_stage_index: 13, status: 'Completed' },
  { project_code: 'PRJ-2605', customer_id: customerIds[4], name: 'Hillview Residence', customer_name: 'Aditya Shah', project_type: 'Residential Interior Design', designer: 'Sneha Patel', contractor: 'Apex Constructions', location: 'Pune', budget: 5600000, start_date: '2026-06-20', end_date: '2026-09-30', priority: 'High', current_stage_index: 3, status: 'Ongoing' },
  { project_code: 'PRJ-2606', customer_id: customerIds[5], name: 'Lakeside Kitchen Suite', customer_name: 'Neha Gupta', project_type: 'Modular Kitchen', designer: 'Arjun Kumar', contractor: 'BuildWell Interiors', location: 'Delhi', budget: 2100000, start_date: '2026-04-01', end_date: '2026-06-15', priority: 'Medium', current_stage_index: 8, status: 'Delayed' },
  { project_code: 'PRJ-2607', customer_id: customerIds[6], name: 'Kochi Boutique Office', customer_name: 'Divya Menon', project_type: 'Commercial Interior Design', designer: 'Ananya Rao', contractor: 'UrbanCraft Works', location: 'Kochi', budget: 1200000, start_date: '2026-03-05', end_date: '2026-09-01', priority: 'Low', current_stage_index: 5, status: 'On Hold' },
  { project_code: 'PRJ-2608', customer_id: customerIds[7], name: 'Singh Farmhouse Interiors', customer_name: 'Vikram Singh', project_type: 'Villa Interior Design', designer: 'Rahul Verma', contractor: 'Coastal Build Co.', location: 'Coimbatore', budget: 3600000, start_date: '2025-06-15', end_date: '2025-09-30', priority: 'Medium', current_stage_index: 13, status: 'Completed' },
  { project_code: 'PRJ-2609', customer_id: customerIds[8], name: 'Iyer Penthouse Makeover', customer_name: 'Ananya Iyer', project_type: 'Apartment Interior Design', designer: 'Sneha Patel', contractor: 'Apex Constructions', location: 'Bengaluru', budget: 2800000, start_date: '2026-07-20', end_date: '2026-11-10', priority: 'Medium', current_stage_index: 1, status: 'Ongoing' }
]
const projectIds = PROJECTS.map((p) => insertProject.run(p).lastInsertRowid)

const insertQuotation = db.prepare(`
  INSERT INTO quotations (quotation_code, project_id, customer_name, project_name, project_type, amount, status, date, valid_until)
  VALUES (@quotation_code, @project_id, @customer_name, @project_name, @project_type, @amount, @status, @date, @valid_until)
`)
const QUOTATIONS = [
  { quotation_code: 'QT-2026-001', project_id: projectIds[0], customer_name: 'Priya Mehta', project_name: 'Skyline Penthouse', project_type: 'Luxury Residential', amount: 4800000, status: 'Approved', date: '2026-07-15', valid_until: '2026-07-30' },
  { quotation_code: 'QT-2026-002', project_id: projectIds[1], customer_name: 'Rahul Sharma', project_name: 'Bandra Villa Redo', project_type: 'Modern Villa', amount: 3200000, status: 'Pending', date: '2026-07-12', valid_until: '2026-07-27' },
  { quotation_code: 'QT-2026-003', project_id: projectIds[2], customer_name: 'Meera Joshi', project_name: 'Modern Office Interior', project_type: 'Commercial', amount: 1850000, status: 'Approved', date: '2026-07-10', valid_until: '2026-07-25' },
  { quotation_code: 'QT-2026-004', project_id: projectIds[3], customer_name: 'Kavya Nair', project_name: 'Coastal Apartment', project_type: 'Residential', amount: 2400000, status: 'Rejected', date: '2026-07-05', valid_until: '2026-07-20' },
  { quotation_code: 'QT-2026-005', project_id: projectIds[4], customer_name: 'Aditya Shah', project_name: 'Hillview Residence', project_type: 'Residential', amount: 5600000, status: 'Pending', date: '2026-07-18', valid_until: '2026-08-02' },
  { quotation_code: 'QT-2026-006', project_id: projectIds[5], customer_name: 'Neha Gupta', project_name: 'Lakeside Kitchen Suite', project_type: 'Modular Kitchen', amount: 2100000, status: 'Approved', date: '2026-06-28', valid_until: '2026-07-13' }
]
QUOTATIONS.forEach((q) => insertQuotation.run(q))

const insertAppointment = db.prepare(`
  INSERT INTO appointments (project_id, customer_name, project_name, designer, date, time, time_label, mode, location, tag, status)
  VALUES (@project_id, @customer_name, @project_name, @designer, @date, @time, @time_label, @mode, @location, @tag, @status)
`)
const APPOINTMENTS = [
  { project_id: projectIds[0], customer_name: 'Priya Mehta', project_name: 'Skyline Penthouse', designer: 'Sneha Patel', date: '2026-07-20', time: '10:30', time_label: '10:30 AM', mode: 'In Person', location: 'IDCP Design Studio', tag: 'Design Review', status: 'Confirmed' },
  { project_id: projectIds[1], customer_name: 'Rahul Sharma', project_name: 'Bandra Villa Redo', designer: 'Arjun Kumar', date: '2026-07-21', time: '14:00', time_label: '02:00 PM', mode: 'Virtual Meeting', location: 'Virtual Meeting', tag: 'Material Selection', status: 'Confirmed' },
  { project_id: projectIds[2], customer_name: 'Meera Joshi', project_name: 'Modern Office Interior', designer: 'Ananya Rao', date: '2026-07-25', time: '11:00', time_label: '11:00 AM', mode: 'Site Visit', location: 'Project Site', tag: 'Final Review', status: 'Pending' },
  { project_id: projectIds[3], customer_name: 'Kavya Nair', project_name: 'Coastal Apartment', designer: 'Rahul Verma', date: '2026-07-27', time: '15:30', time_label: '03:30 PM', mode: 'In Person', location: 'IDCP Design Studio', tag: 'Project Discussion', status: 'Confirmed' },
  { project_id: projectIds[4], customer_name: 'Aditya Shah', project_name: 'Hillview Residence', designer: 'Sneha Patel', date: '2026-07-14', time: '09:30', time_label: '09:30 AM', mode: 'Site Visit', location: 'Project Site', tag: 'Site Measurement', status: 'Completed' },
  { project_id: projectIds[5], customer_name: 'Neha Gupta', project_name: 'Lakeside Kitchen Suite', designer: 'Arjun Kumar', date: '2026-07-08', time: '16:00', time_label: '04:00 PM', mode: 'Virtual Meeting', location: 'Virtual Meeting', tag: 'Procurement Update', status: 'Cancelled' }
]
APPOINTMENTS.forEach((a) => insertAppointment.run(a))

const insertPayment = db.prepare(`
  INSERT INTO payments (invoice_id, project_id, customer_name, project_name, amount, currency, method, payment_date, due_date, status, transaction_id, gateway)
  VALUES (@invoice_id, @project_id, @customer_name, @project_name, @amount, 'INR', @method, @payment_date, @due_date, @status, @transaction_id, @gateway)
`)
const PAYMENTS = [
  { invoice_id: 'INV-2026-001', project_id: projectIds[0], customer_name: 'Priya Mehta', project_name: 'Skyline Penthouse', amount: 2400000, method: 'Bank Transfer', payment_date: '2026-07-18', due_date: '2026-07-15', status: 'Paid', transaction_id: 'TXN-SEED-0001', gateway: 'mock' },
  { invoice_id: 'INV-2026-002', project_id: projectIds[1], customer_name: 'Rahul Sharma', project_name: 'Bandra Villa Redo', amount: 1600000, method: 'UPI', payment_date: null, due_date: '2026-07-24', status: 'Pending', transaction_id: null, gateway: null },
  { invoice_id: 'INV-2026-003', project_id: projectIds[2], customer_name: 'Meera Joshi', project_name: 'Modern Office Interior', amount: 1850000, method: 'Credit Card', payment_date: '2026-07-15', due_date: '2026-07-12', status: 'Paid', transaction_id: 'TXN-SEED-0003', gateway: 'mock' },
  { invoice_id: 'INV-2026-004', project_id: projectIds[3], customer_name: 'Kavya Nair', project_name: 'Coastal Apartment', amount: 1200000, method: 'Bank Transfer', payment_date: '2026-06-10', due_date: '2026-06-05', status: 'Overdue', transaction_id: null, gateway: null },
  { invoice_id: 'INV-2026-005', project_id: projectIds[4], customer_name: 'Aditya Shah', project_name: 'Hillview Residence', amount: 2000000, method: 'Bank Transfer', payment_date: '2026-07-02', due_date: '2026-06-30', status: 'Paid', transaction_id: 'TXN-SEED-0005', gateway: 'mock' }
]
PAYMENTS.forEach((p) => insertPayment.run(p))

// ---------------------------------------------------------------------
// Test user accounts — one per role. Passwords come from environment
// variables so they are never hard-coded in source. If a variable is
// missing, a random password is generated and printed once so the
// operator can still log in and is nudged to set it explicitly.
// ---------------------------------------------------------------------
function randomPassword() {
  return Math.random().toString(36).slice(2, 10) + 'A1!'
}

const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, role, role_label, avatar_initial, customer_id, designer_id, contractor_id)
  VALUES (@name, @email, @password_hash, @role, @role_label, @avatar_initial, @customer_id, @designer_id, @contractor_id)
`)

const designerRow = db.prepare('SELECT id FROM designers WHERE name = ?').get('Ananya Rao')
const contractorRow = db.prepare('SELECT id FROM contractors WHERE name = ?').get('Apex Constructions')
const customerRow = db.prepare('SELECT id FROM customers WHERE name = ?').get('Priya Mehta')

const TEST_ACCOUNTS = [
  {
    role: 'admin', role_label: 'Administrator', name: 'Monisha', avatarInitial: 'M',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@idcp.com',
    password: process.env.SEED_ADMIN_PASSWORD,
    customer_id: null, designer_id: null, contractor_id: null
  },
  {
    role: 'designer', role_label: 'Designer', name: 'Ananya Rao', avatarInitial: 'A',
    email: process.env.SEED_DESIGNER_EMAIL || 'designer@idcp.com',
    password: process.env.SEED_DESIGNER_PASSWORD,
    customer_id: null, designer_id: designerRow?.id ?? null, contractor_id: null
  },
  {
    role: 'customer', role_label: 'Customer', name: 'Priya Mehta', avatarInitial: 'P',
    email: process.env.SEED_CUSTOMER_EMAIL || 'customer@idcp.com',
    password: process.env.SEED_CUSTOMER_PASSWORD,
    customer_id: customerRow?.id ?? null, designer_id: null, contractor_id: null
  },
  {
    role: 'contractor', role_label: 'Contractor', name: 'Mahesh Iyer', avatarInitial: 'M',
    email: process.env.SEED_CONTRACTOR_EMAIL || 'contractor@idcp.com',
    password: process.env.SEED_CONTRACTOR_PASSWORD,
    customer_id: null, designer_id: null, contractor_id: contractorRow?.id ?? null
  }
]

console.log('\n================  IDCP TEST LOGIN CREDENTIALS  ================')
for (const acc of TEST_ACCOUNTS) {
  const plainPassword = acc.password || randomPassword()
  const hash = bcrypt.hashSync(plainPassword, 12)
  insertUser.run({
    name: acc.name,
    email: acc.email.toLowerCase(),
    password_hash: hash,
    role: acc.role,
    role_label: acc.role_label,
    avatar_initial: acc.avatarInitial,
    customer_id: acc.customer_id,
    designer_id: acc.designer_id,
    contractor_id: acc.contractor_id
  })
  console.log(`${acc.role_label.padEnd(14)} email: ${acc.email.padEnd(24)} password: ${plainPassword}`)
}
console.log('==================================================================\n')
console.log('Seed complete.')
