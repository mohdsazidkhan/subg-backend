# SUBG Backend

A comprehensive quiz platform backend with advanced analytics, user level system, subscription management, and monthly highscore rewards system.

## 💰 Wallet System Configuration

The wallet system is fully configurable through environment variables:

### Environment Variables
- `PRO_USER_CREDIT_AMOUNT`: Amount earned per approved question (default: 10)
- `PRO_USER_APPROVALS_PER_CREDIT`: Number of approvals per credit (default: 10)
- `MIN_APPROVED_QUESTIONS`: Minimum approved questions for withdrawal (default: 100)
- `MIN_WITHDRAW_AMOUNT`: Minimum withdrawal amount in rupees (default: 1000)

### Default Configuration
- **Earning Rate**: ₹10 per approved question
- **Withdrawal Threshold**: 100 approved questions = ₹1000
- **Minimum Withdrawal**: ₹1000
- **Perfect Alignment**: 100 questions = ₹1000 = Minimum withdrawal

### How It Works
1. User creates question → Status: Pending
2. Admin approves question → User earns ₹10
3. After 100 approved questions → Withdrawal enabled
4. User can withdraw ₹1000 or more
5. Withdrawal processed within 24-48 hours

## 🚀 Features

### Core Features
- **User Management**: Registration, authentication, role-based access (admin/student)
- **Quiz System**: Level-based quizzes with single attempt system
- **Analytics**: Comprehensive admin analytics with charts and reports
- **Subscription System**: Multiple subscription tiers (free, basic, premium, pro)
- **Payment Integration**: Razorpay payment gateway
- **Wallet System**: User wallet and transaction management with configurable earning rates

### Advanced Features
- **Level System**: 10 progressive levels with badges and achievements
- **Category Management**: Quiz categories and subcategories
- **Admin Panel**: Full admin dashboard with analytics
- **Security**: JWT authentication, input validation, rate limiting
- **Analytics**: Dashboard, user, quiz, financial, and performance analytics
- **Monthly Highscore System**: Monthly quiz competitions with prize distribution
- **Referral System**: Smart referral rewards with subscription upgrades
- **Migration Tools**: Comprehensive data migration and testing scripts
- **Configurable Wallet System**: Environment-based configuration for earning rates and withdrawal limits

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Razorpay account (for payments)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd subg-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   MONGO_URI=mongodb://localhost:27017/subgquiz
   MONGODB_URI=mongodb://localhost:27017/subgquiz
   
   # JWT Configuration
   JWT_SECRET=your_jwt_secret_here
   JWT_EXPIRES_IN=1d
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   BACKEND_URL=http://localhost:5000
   FRONTEND_URL=http://localhost:3000
   
   # Admin Configuration
   ADMIN_NAME=Admin
   ADMIN_EMAIL=admin@subgquiz.com
   ADMIN_PHONE=1234567890
   ADMIN_PASSWORD=admin123
   
   # Email Configuration
   BREVO_EMAIL_API_KEY=your_brevo_api_key_here
   
   # Payment Gateway Configuration
   PAYU_MERCHANT_ID=your_payu_merchant_id
   PAYU_MERCHANT_KEY=your_payu_merchant_key
   PAYU_MERCHANT_SALT=your_payu_merchant_salt
   PAYU_MERCHANT_ID_TEST=your_payu_test_merchant_id
   PAYU_MERCHANT_KEY_TEST=your_payu_test_merchant_key
   PAYU_MERCHANT_SALT_TEST=your_payu_test_merchant_salt
   
   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Wallet System Configuration
   PRO_USER_APPROVALS_PER_CREDIT=10
   PRO_USER_CREDIT_AMOUNT=10
   MIN_APPROVED_QUESTIONS=100
   MIN_WITHDRAW_AMOUNT=1000
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB
   mongod
   ```

5. **Start the server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## 📁 Project Structure

```
subg-backend/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
├── models/           # Database models
├── routes/           # API routes
├── scripts/          # Database scripts and utilities
├── utils/            # Utility functions
├── index.js          # Main server file
├── package.json      # Project manifest
├── package-lock.json # Dependency lockfile
└── README.md         # Project documentation
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration (with referral system)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/google` - Google OAuth registration

### Admin Routes
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

### Analytics Routes
- `GET /api/analytics/dashboard` - Dashboard analytics
- `GET /api/analytics/users` - User analytics
- `GET /api/analytics/quizzes` - Quiz analytics
- `GET /api/analytics/financial` - Financial analytics
- `GET /api/analytics/performance` - Performance analytics

### Quiz Routes
- `GET /api/quizzes` - Get all quizzes
- `POST /api/quizzes` - Create quiz
- `PUT /api/quizzes/:id` - Update quiz
- `DELETE /api/quizzes/:id` - Delete quiz
- `POST /api/quizzes/:id/attempt` - Submit quiz attempt

### Student Routes
- `GET /api/student/homepage-data` - Get homepage data (categories, subcategories, level-wise quizzes excluding attempted ones)
- `GET /api/student/quizzes/home-level` - Get level-based quizzes for homepage
- `GET /api/student/quizzes/level-based` - Get quizzes by level
- `GET /api/student/quizzes/recommended` - Get recommended quizzes
- `GET /api/student/quizzes/difficulty-distribution` - Get quiz difficulty distribution
- `GET /api/student/profile` - Get user profile
- `GET /api/student/leaderboard` - Get leaderboard
- `GET /api/student/leaderboard/quiz/:quizId` - Get quiz-specific leaderboard

### Subscription Routes
- `GET /api/subscriptions` - Get subscriptions
- `POST /api/subscriptions` - Create subscription
- `PUT /api/subscriptions/:id` - Update subscription

### Public Routes
- `GET /api/public/categories` - Get all categories
- `GET /api/public/subcategories` - Get subcategories by category
- `GET /api/public/search` - Search quizzes and categories

## 🗄️ Database Models

### User Model
- Basic info (name, email, phone, password)
- Level system (current level, progress, badges)
- Quiz best scores (single attempt system)
- Subscription status and expiry
- Referral system (referralCode, referralCount, referredBy)
- Monthly progress tracking
- Migration tracking fields

### Quiz Model
- Title, category, subcategory
- Difficulty levels (beginner to expert)
- Level requirements and recommendations
- Time limits and scoring

### Subscription Model
- Plan types (free, basic, premium, pro)
- Payment information
- Features and access levels
- Expiry and renewal settings
- Referral reward metadata

### Analytics Models
- Quiz attempts and scores
- Payment orders and transactions
- User engagement metrics

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access**: Admin and student role separation
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API rate limiting for security
- **Password Hashing**: Secure password storage
- **CORS Protection**: Cross-origin request protection

## 📊 Analytics System

### Dashboard Analytics
- Total users, quizzes, and revenue overview
- Level distribution charts
- Subscription distribution
- Recent activity feed
- Top performing users

### User Analytics
- User growth trends
- Level progression analysis
- Subscription statistics
- Engagement metrics
- Performance rankings

### Quiz Analytics
- Quiz popularity and performance
- Category and difficulty analysis
- Attempt statistics
- Score distributions
- Top quizzes by engagement

### Financial Analytics
- Revenue trends and projections
- Subscription plan performance
- Payment success rates
- Revenue by plan type
- Financial reporting

### Performance Analytics
- Score distribution analysis
- Level performance metrics
- Category performance comparison
- User achievement tracking

## 🎯 Level System

### Level Progression
1. **Starter** (Level 0) - 0 total quiz attempts required - 0
2. **Rookie** (Level 1) - 4 total quiz attempts required - 4
3. **Explorer** (Level 2) - 12 total quiz attempts required - 8
4. **Thinker** (Level 3) - 24 total quiz attempts required - 12
5. **Strategist** (Level 4) - 40 total quiz attempts required - 16
6. **Achiever** (Level 5) - 60 total quiz attempts required - 20
7. **Mastermind** (Level 6) - 84 total quiz attempts required - 24
8. **Champion** (Level 7) - 112 total quiz attempts required - 28
9. **Prodigy** (Level 8) - 144 total quiz attempts required - 32
10. **Wizard** (Level 9) - 180 total quiz attempts required - 36
11. **Legend** (Level 10) - 220 total quiz attempts required - 40

**Note**: Level progression is now based on total quiz attempts completed. High-score quizzes (75% or higher) are tracked separately for monthly rewards eligibility.

### Features
- Automatic level calculation based on total quiz attempts
- Level-specific badges and achievements
- Progress tracking to next level
- Subscription-based level access control

## 🏆 Monthly Top 10 Reward System

### Monthly Competition
- **Duration**: Monthly (resets on last day of each month)
- **Eligibility**: Level 10 + ≥ 220 high-score quizzes (75%+ accuracy)
- **Prize Pool**: Configurable via MONTHLY_PRIZE_POOL environment variable (default: ₹10,000)
- **Distribution**: Top 10 users with fixed percentages

### Prize Distribution
- **1st Place**: 25% of total prize pool - 2500
- **2nd Place**: 20% of total prize pool - 2000
- **3rd Place**: 15% of total prize pool - 1500
- **4th Place**: 12% of total prize pool - 1200
- **5th Place**: 8% of total prize pool - 800
- **6th Place**: 6% of total prize pool - 600
- **7th Place**: 5% of total prize pool - 500
- **8th Place**: 4% of total prize pool - 400
- **9th Place**: 3.5% of total prize pool - 350
- **10th Place**: 1.5% of total prize pool - 150

### Features
- Automatic monthly reset via CRON job
- Real-time progress tracking
- Reward distribution system
- Progress persistence across months

## 🎁 Referral System

### Referral Rewards
- **2 Referrals**: Basic Plan (₹9/month for 30 days)
- **5 Referrals**: Premium Plan (₹49/month for 30 days)
- **10 Referrals**: Pro Plan (₹99/month for 30 days)

### Smart Upgrade Logic
- **No Downgrades**: Users keep better existing plans
- **Plan Hierarchy**: free < basic < premium < pro
- **Automatic Upgrades**: Only when beneficial
- **Badge System**: Referral Starter, Master, Legend badges

### Features
- Referral code generation
- Referral tracking and counting
- Automatic subscription upgrades
- Badge awards
- Both regular and Google OAuth support

## 💳 Subscription System

### Plan Types & Pricing
- **Free**: Basic access to levels 0-3 (₹0/month)
- **Basic**: Access to levels 0-6 - ₹9/month
- **Premium**: Access to levels 0-9 - ₹49/month
- **Pro**: Full access to all levels (0-10) - ₹99/month

### Features
- Automatic plan assignment
- Expiry date management
- Payment integration with Razorpay
- Feature access control
- Renewal notifications
- Referral reward integration

## 🚀 Deployment

### Production Setup
1. Set up MongoDB Atlas or local MongoDB
2. Configure environment variables
3. Set up Razorpay production keys
4. Deploy to your preferred hosting platform

### Environment Variables
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

## 📝 Scripts

### Database Scripts
- `addDescriptionToCategories.js` - Add descriptions to categories
- `createAdmin.js` - Create admin user
- `migrateExistingUsersToFree.js` - Migrate users to free subscription

### Migration Scripts
- `migrateToMonthlySystem.js` - Migrate users to new monthly system
- `testMigration.js` - Test migration without executing
- `backupDatabase.js` - Backup MongoDB database

### Testing Scripts
- `testReferralSystem.js` - Test referral system functionality
- `check-database.js` - Database connection test

### Utility Scripts
- `createCustomAdmin.js` - Create custom admin user
- `reset-admin-password.js` - Reset admin password

## 🧪 Testing & Migration

### Available Commands
```bash
# Test referral system
npm run test:referral

# Test migration (preview only)
npm run migrate:test

# Execute migration
npm run migrate:run

# Get migration help
npm run migrate:help

# Backup database
npm run backup
```

### Migration Process
1. **Test Migration**: Preview changes without affecting data
2. **Backup Database**: Create backup before migration
3. **Execute Migration**: Reset users to Level 0, clear progress
4. **Verify Results**: Check migration success

### Migration Features
- **Fresh Start**: All users reset to Level 0
- **Progress Reset**: Monthly progress cleared
- **Subscription Reset**: All subscriptions reset to free
- **Data Preservation**: Old data stored in migration details
- **Safe Execution**: Rollback capability

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Version History

- **v1.0.0** - Initial release with basic quiz functionality
- **v2.0.0** - Added level system and analytics
- **v3.0.0** - Enhanced admin panel and security features
- **v4.0.0** - Advanced analytics and subscription system
- **v5.0.0** - Monthly highscore system and referral rewards
- **v6.0.0** - Smart referral system and migration tools 