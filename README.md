# SUBG Backend

A comprehensive quiz platform backend with advanced analytics, user level system, and subscription management.

## 🚀 Features

### Core Features
- **User Management**: Registration, authentication, role-based access (admin/student)
- **Quiz System**: Level-based quizzes with single attempt system
- **Analytics**: Comprehensive admin analytics with charts and reports
- **Subscription System**: Multiple subscription tiers (free, basic, premium, pro)
- **Payment Integration**: Razorpay payment gateway
- **Leaderboard System**: Real-time quiz leaderboards
- **Wallet System**: User wallet and transaction management

### Advanced Features
- **Level System**: 10 progressive levels with badges and achievements
- **Category Management**: Quiz categories and subcategories
- **Admin Panel**: Full admin dashboard with analytics
- **Security**: JWT authentication, input validation, rate limiting
- **Analytics**: Dashboard, user, quiz, financial, and performance analytics

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
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/subg
   JWT_SECRET=your_jwt_secret_here
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
├── utils/            # Utility functions
├── index.js          # Main server file
├── package.json      # Project manifest
├── package-lock.json # Dependency lockfile
└── README.md         # Project documentation
```

> **Note:** Legacy scripts and test files have been removed for clarity and maintainability. The backend is now clean and only contains necessary files for running the API server.

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

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

## 🗄️ Database Models

### User Model
- Basic info (name, email, phone, password)
- Level system (current level, progress, badges)
- Quiz best scores (single attempt system)
- Subscription status and expiry

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

### Analytics Models
- Quiz attempts and scores
- Payment orders and transactions
- Leaderboard entries
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
- Leaderboard statistics
- User achievement tracking

## 🎯 Level System

### Level Progression
1. **Rookie** (Level 1) - 2 high-score quizzes (75%+) required
2. **Explorer** (Level 2) - 4 high-score quizzes (75%+) required
3. **Thinker** (Level 3) - 8 high-score quizzes (75%+) required
4. **Strategist** (Level 4) - 16 high-score quizzes (75%+) required
5. **Achiever** (Level 5) - 32 high-score quizzes (75%+) required
6. **Mastermind** (Level 6) - 64 high-score quizzes (75%+) required
7. **Champion** (Level 7) - 128 high-score quizzes (75%+) required
8. **Prodigy** (Level 8) - 256 high-score quizzes (75%+) required
9. **Quiz Wizard** (Level 9) - 512 high-score quizzes (75%+) required
10. **Legend** (Level 10) - 1024 high-score quizzes (75%+) required

**Note**: Level progression is based on high-score quizzes (75% or higher). All quiz attempts are tracked for analytics.

### Features
- Automatic level calculation based on high-score quizzes (≥80%)
- Level-specific badges and achievements
- Progress tracking to next level
- Subscription-based level access control

## 💳 Subscription System

### Plan Types
- **Free**: Basic access to levels 1-3
- **Basic**: Access to levels 1-6 - 99
- **Premium**: Access to levels 1-9 - 499
- **Pro**: Full access to all levels (1-10) 999

### Features
- Automatic plan assignment
- Expiry date management
- Payment integration with Razorpay
- Feature access control
- Renewal notifications

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

### Utility Scripts
- `check-database.js` - Database connection test
- `createCustomAdmin.js` - Create custom admin user
- `reset-admin-password.js` - Reset admin password

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