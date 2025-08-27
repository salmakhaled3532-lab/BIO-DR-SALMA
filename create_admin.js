// Simple script to create admin user in localStorage for login system
// This bypasses the need for SQLite database setup

console.log('Creating admin user in localStorage...');

// Create admin user directly in localStorage
const adminUser = {
    id: 1,
    fullName: 'Dr. Salma Khaled',
    email: 'dr.salma.khaled@bioplatform.com',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    status: 'active',
    registrationDate: new Date().toISOString()
};

// Get existing registered users
const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');

// Check if admin already exists
const existingAdmin = registeredUsers.find(user => user.username === 'admin');

if (!existingAdmin) {
    // Add admin to registered users
    registeredUsers.push(adminUser);
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
    console.log('Admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
} else {
    console.log('Admin user already exists!');
}

console.log('Admin setup complete. You can now login with admin/admin123');
