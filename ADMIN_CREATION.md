# Admin Creation Tool

This tool allows you to create admin users for the SUBG backend application with proper validation and setup.

## User Model Overview

The User model includes the following key features:

### Basic Fields
- **name**: String (required, min 2 characters)
- **email**: String (required, unique, validated format)
- **phone**: String (required, unique, 10 digits)
- **password**: String (required, min 6 characters, hashed)
- **role**: Enum ['admin', 'student'] (default: 'student')

### Level System (11 levels: 0-10)
- **Level 0**: Zero Level - Just registered
- **Level 1**: Rookie - Easy questions
- **Level 2**: Explorer - Slightly challenging
- **Level 3**: Thinker - Moderate difficulty
- **Level 4**: Strategist - Mix of logic, memory, and speed
- **Level 5**: Achiever - Cross-topic challenges
- **Level 6**: Mastermind - For those who aim to win
- **Level 7**: Champion - Beat timer and brain
- **Level 8**: Prodigy - High-level puzzles
- **Level 9**: Quiz Wizard - Complex questions
- **Level 10**: Legend - Final frontier

### Subscription System
- **free**: Levels 0-3 access
- **basic**: Levels 0-6 access
- **premium**: Levels 0-9 access
- **pro**: All levels (0-10) access

### Admin Privileges
- **Lifetime subscription** (expires in 2099)
- **Access to all levels** (0-10) regardless of subscription
- **Special admin badges**: Admin, System Administrator, Legend Badge
- **Maximum level**: Legend (Level 10)
- **All premium features** enabled

## Usage

### 1. Interactive Mode
Create an admin user by answering prompts:

```bash
node createAdmin.js interactive
```

This will prompt you for:
- Admin name
- Admin email
- Admin phone (10 digits)
- Admin password (min 6 characters)

### 2. Command Line Mode
Create an admin user with provided data:

```bash
node createAdmin.js create "John Admin" "admin@example.com" "1234567890" "password123"
```

### 3. Environment Variables Mode
Create an admin user using credentials from `.env` file:

```bash
node createAdmin.js env
```

This requires the following variables in your `.env` file:
```
ADMIN_NAME=Your Admin Name
ADMIN_EMAIL=admin@example.com
ADMIN_PHONE=1234567890
ADMIN_PASSWORD=yourpassword
```

### 4. List Admins
View all existing admin users:

```bash
node createAdmin.js list
```

## Examples

### Create Admin Interactively
```bash
$ node createAdmin.js interactive
🚀 Admin Creation Tool
=====================

Enter admin name: John Doe
Enter admin email: admin@subgquiz.com
Enter admin phone (10 digits): 9876543210
Enter admin password (min 6 characters): securepass123

🔍 Creating admin...
✅ Admin created successfully!
📋 Admin Details:
   Name: John Doe
   Email: admin@subgquiz.com
   Phone: 9876543210
   Role: admin
   Subscription: free (Lifetime)
   Level: Legend (Level 10)
   Badges: Admin, System Administrator, Legend Badge
   Created: 2024-01-15T10:30:00.000Z

🎉 Admin can now login with their email and password!
```

### Create Admin with Command Line
```bash
$ node createAdmin.js create "Jane Admin" "jane@subgquiz.com" "9876543210" "mypassword123"
✅ Admin created successfully!
📋 Admin Details:
   Name: Jane Admin
   Email: jane@subgquiz.com
   Phone: 9876543210
   Role: admin
   Subscription: free (Lifetime)
   Level: Legend (Level 10)
   Badges: Admin, System Administrator, Legend Badge
   Created: 2024-01-15T10:30:00.000Z

🎉 Admin can now login with their email and password!
```

### Create Admin from Environment Variables
```bash
$ node createAdmin.js env
🔍 Reading admin credentials from .env file...
✅ All environment variables found
   Name: John Admin
   Email: admin@subgquiz.com
   Phone: 9876543210
   Password: ********

✅ Admin created successfully from .env!
📋 Admin Details:
   Name: John Admin
   Email: admin@subgquiz.com
   Phone: 9876543210
   Role: admin
   Subscription: free (Lifetime)
   Level: Legend (Level 10)
   Badges: Admin, System Administrator, Legend Badge
   Created: 2024-01-15T10:30:00.000Z

🎉 Admin can now login with their email and password!
```

### List All Admins
```bash
$ node createAdmin.js list
👥 Admin Users:
================
1. John Doe
   Email: admin@subgquiz.com
   Phone: 9876543210
   Subscription: free
   Created: 1/15/2024

2. Jane Admin
   Email: jane@subgquiz.com
   Phone: 9876543210
   Subscription: free
   Created: 1/15/2024
```

## Validation Rules

The tool validates the following:

1. **Name**: At least 2 characters long
2. **Email**: Valid email format and unique
3. **Phone**: Exactly 10 digits and unique
4. **Password**: At least 6 characters long

## What Gets Created

When you create an admin, the following are automatically set up:

1. **User Record**: With admin role and special badges
2. **Lifetime Subscription**: Expires in 2099 with all features enabled
3. **Level 10 Access**: Maximum level (Legend) with 100% progress
4. **Wallet Transaction**: Record of the free subscription
5. **Admin Badges**: Admin, System Administrator, Legend Badge

## Admin Features

Once created, admins have access to:

- **All quiz levels** (0-10) regardless of subscription
- **Admin dashboard** with full analytics
- **User management** capabilities
- **Quiz and question management**
- **Category and subcategory management**
- **Subscription management**
- **All premium features** without payment

## Security Notes

- Passwords are hashed using bcrypt with salt rounds of 12
- Email and phone numbers are validated and must be unique
- Admin users get lifetime access but can be managed through the admin panel
- All admin actions are logged in the system

## Troubleshooting

### Common Errors

1. **Email already exists**: Use a different email address
2. **Phone already exists**: Use a different phone number
3. **Invalid email format**: Ensure email follows standard format
4. **Phone must be 10 digits**: Enter exactly 10 digits
5. **Password too short**: Use at least 6 characters
6. **Name too short**: Use at least 2 characters

### Database Connection Issues

Make sure your `.env` file contains:
```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

### Environment Variables for Admin Creation

For the `env` mode, add these variables to your `.env` file:
```
ADMIN_NAME=Your Admin Name
ADMIN_EMAIL=admin@example.com
ADMIN_PHONE=1234567890
ADMIN_PASSWORD=yourpassword
```

**Note**: The password will be masked with asterisks (*) in the console output for security.

## API Endpoints for Admins

Once logged in, admins can access:

- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/categories` - Manage categories
- `GET /api/admin/subcategories` - Manage subcategories
- `GET /api/admin/quizzes` - Manage quizzes
- `GET /api/admin/questions` - Manage questions
- `GET /api/admin/students` - Manage students
- `POST /api/admin/assign-badge` - Assign badges to users
- `POST /api/admin/migrate-users-to-free` - Migrate users to free plan

## Support

For issues with admin creation, check:
1. Database connection
2. Environment variables
3. Validation errors in the console output
4. Existing user conflicts 