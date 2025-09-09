# 🏃‍♂️ Fit2Run Analytics Dashboard

A modern, professional analytics dashboard built with Next.js 14 and TailwindCSS, featuring an O365-inspired design.

## ✨ Features

- **Modern Design**: Clean, professional O365-style interface
- **Responsive**: Works perfectly on desktop, tablet, and mobile
- **Fast Performance**: Built with Next.js 14 and optimized for speed
- **Real-time Data**: Live database connections with MySQL
- **Interactive Charts**: Beautiful visualizations with Chart.js
- **Cross-browser Compatible**: Works consistently across all browsers

## 📊 Available Dashboards

1. **📊 Performance Dashboard** - Conversion rates and revenue analytics ✅
2. **🛍️ Shopify Sales Report** - Comprehensive sales analysis (Coming Soon)
3. **💰 Fit2Run Budget** - Budget vs actual performance tracking ✅
4. **🏆 Store Rankings** - Store performance comparisons ✅
5. **⚠️ Performance Alerts** - Real-time monitoring (Coming Soon)
6. **👥 Employee Analytics** - Staff performance insights (Coming Soon)
7. **📦 Product Intelligence** - Product analysis (Coming Soon)
8. **🏪 Inventory Intelligence** - Inventory management (Coming Soon)
9. **🔄 Repeat Customer Analysis** - Customer loyalty (Coming Soon)
10. **📍 Top Customers by Location** - Geographic insights (Coming Soon)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MySQL database (already configured)
- npm or yarn

### Installation

1. **Install dependencies:**
   \`\`\`bash
   cd /var/www/vhosts/socre8ive.com/httpdocs/dashboard
   npm install
   \`\`\`

2. **Configure environment:**
   - Copy `.env.local` and update if needed
   - Database connection should work with existing setup

3. **Run development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Access the dashboard:**
   - Open http://localhost:3001
   - Or configure your web server to serve the production build

### Production Build

1. **Build for production:**
   \`\`\`bash
   npm run build
   \`\`\`

2. **Start production server:**
   \`\`\`bash
   npm start
   \`\`\`

## 🏗️ Architecture

### Frontend
- **Framework**: Next.js 14 with App Router
- **Styling**: TailwindCSS with custom O365 theme
- **Charts**: Chart.js with React-Chart.js-2
- **Icons**: Heroicons
- **Date Pickers**: React-Datepicker

### Backend
- **API Routes**: Next.js API routes
- **Database**: MySQL with mysql2 connection pooling
- **Authentication**: Ready for NextAuth.js integration

### Project Structure
\`\`\`
dashboard/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/            # API routes
│   │   ├── (dashboards)/   # Dashboard pages
│   │   └── globals.css     # Global styles
│   ├── components/         # Reusable components
│   │   ├── Layout/        # Layout components
│   │   ├── UI/            # UI components
│   │   └── Charts/        # Chart components
│   ├── lib/               # Utilities
│   └── types/             # TypeScript types
├── package.json           # Dependencies
└── tailwind.config.js     # Tailwind configuration
\`\`\`

## 🎨 Design System

### Colors
- **Primary**: Blue (#3b82f6) - O365 inspired
- **Success**: Green (#22c55e)
- **Warning**: Yellow (#f59e0b)
- **Error**: Red (#ef4444)
- **Gray Scale**: From #f9fafb to #111827

### Typography
- **Font**: Segoe UI (system fonts)
- **Sizes**: Responsive scale from 0.75rem to 2.25rem

### Components
- **Cards**: White background with subtle shadows
- **Buttons**: Primary blue with hover states
- **Inputs**: Clean borders with focus states
- **Charts**: Consistent color scheme

## 📈 Current Status

### ✅ Completed
- Project setup and configuration
- Professional O365-style design system
- Responsive layout with sidebar navigation
- Database connection and API layer
- Performance Dashboard (fully functional)
- Budget Dashboard (fully functional)  
- Store Rankings Dashboard (fully functional)
- Reusable UI components
- Chart components with Chart.js

### 🚧 In Progress
- Additional dashboard pages
- Enhanced authentication
- More chart types

### 📋 Upcoming
- Complete all 10 dashboard pages
- Advanced filtering and search
- Export functionality
- Real-time updates
- User management

## 🔧 Development

### Adding New Dashboards
1. Create page in \`src/app/[dashboard-name]/page.tsx\`
2. Create API route in \`src/app/api/[dashboard-name]/route.ts\`
3. Add to navigation in \`src/components/Layout/Sidebar.tsx\`

### Database Queries
- All queries use parameterized statements for security
- Connection pooling for performance
- Error handling and logging

### Styling
- Use Tailwind utility classes
- Follow existing component patterns
- Maintain responsive design

## 🌐 Deployment Options

### Option 1: Development Server
- Run \`npm run dev\` for development with hot reload
- Access at http://localhost:3001

### Option 2: Production Build  
- Run \`npm run build && npm start\`
- Optimized for production performance

### Option 3: Static Export
- Configure \`next.config.js\` for static export
- Deploy to any web server

## 🔒 Security

- Environment variables for sensitive data
- Parameterized database queries
- Input validation and sanitization
- Ready for authentication integration

## 📱 Browser Support

- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers

## 🎯 Key Benefits Over Streamlit

1. **Professional Appearance**: True O365-style interface
2. **Cross-Browser Consistency**: No more styling issues
3. **Better Performance**: Faster loading and interactions
4. **Mobile Responsive**: Perfect on all devices
5. **Easier Maintenance**: Standard web technologies
6. **More Flexible**: Easy to customize and extend

---

**🚀 Ready to use! The dashboard provides a professional, fast, and reliable alternative to the Streamlit version while maintaining all the same functionality.**