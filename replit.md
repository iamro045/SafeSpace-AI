# Project Clean - AI Content Moderation System

## Overview

Project Clean is an offline AI-powered content moderation system designed for social media platforms. The application provides real-time detection and moderation of text and image content in both English and Hindi, with a comprehensive admin dashboard for content review, user management, and analytics. Built as a full-stack web application, it features a React-based frontend for both admin and social demo interfaces, an Express.js backend API, and integrated AI services for content analysis. The system includes user reputation scoring, automated moderation workflows, and detailed analytics to help moderators maintain safe online communities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built with React 18 using TypeScript and modern tooling:
- **UI Framework**: React with TypeScript, styled using Tailwind CSS and shadcn/ui component library
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Build Tool**: Vite with custom configuration for development and production builds
- **Component Structure**: Modular component architecture with separate directories for UI components, layout components, and feature-specific components (analytics, moderation, social)

### Backend Architecture
The server-side follows a REST API architecture:
- **Framework**: Express.js with TypeScript running on Node.js
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **API Design**: RESTful endpoints organized by feature domains (auth, posts, users, moderation, analytics)
- **Middleware**: Custom logging, error handling, and authentication middleware
- **Development**: Hot-reloading with Vite integration for seamless development experience

### Data Storage Solutions
The application uses PostgreSQL as the primary database with Drizzle ORM:
- **Database**: PostgreSQL (configured for Neon Database service)
- **ORM**: Drizzle ORM with TypeScript schema definitions
- **Schema Design**: Normalized relational schema with tables for users, posts, comments, moderation actions, reputation history, AI model status, and content reports
- **Migrations**: Database schema versioning through Drizzle Kit migrations in the `/migrations` directory
- **Connection**: Neon serverless PostgreSQL connection via `@neondatabase/serverless`

### Authentication and Authorization
Security is implemented through a multi-layer approach:
- **Authentication**: JWT tokens with configurable secret key
- **Authorization**: Role-based access control with user, moderator, and admin roles
- **Session Management**: JWT tokens stored client-side with automatic token validation
- **Password Security**: Bcrypt hashing for password storage
- **Route Protection**: Middleware-based route protection requiring valid authentication tokens

### AI and Moderation Services
The content moderation system includes specialized AI analysis services:
- **Text Analysis**: Multi-language support for English and Hindi content analysis
- **Content Categories**: Detection of hate speech, spam, inappropriate content, nudity, violence, and repetitive content
- **Confidence Scoring**: AI confidence levels from 0-1 with configurable thresholds for auto-approval, flagging, and blocking
- **Rule-based Detection**: Pattern matching for common violation types with language-specific rule sets
- **Image Analysis**: Placeholder structure for computer vision-based image content analysis
- **Reputation Integration**: Automatic user reputation adjustments based on violation types and AI confidence levels

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Router (Wouter), TanStack Query for state management
- **TypeScript**: Full TypeScript support with strict type checking
- **Build Tools**: Vite for development and production builds, ESBuild for server bundling
- **UI Framework**: Tailwind CSS for styling, shadcn/ui component library, Radix UI primitives

### Backend Services
- **Database**: Neon Database (serverless PostgreSQL) with connection pooling
- **ORM**: Drizzle ORM with Drizzle Kit for migrations and schema management
- **Authentication**: JSON Web Tokens (jsonwebtoken), bcrypt for password hashing
- **Session Storage**: connect-pg-simple for PostgreSQL session storage

### Development and Build Tools
- **Development**: TSX for TypeScript execution, Replit integration tools for live development
- **Code Quality**: TypeScript strict mode, ESLint configuration through Vite
- **Asset Handling**: PostCSS with Tailwind CSS and Autoprefixer
- **Font Integration**: Google Fonts (Inter), Font Awesome icons for UI elements

### Third-party UI Components
- **Component Library**: Comprehensive set of Radix UI primitives including dialogs, dropdowns, forms, navigation, and data visualization components
- **Form Handling**: React Hook Form with Hookform Resolvers for validation
- **Date Handling**: date-fns for date formatting and manipulation
- **Utility Libraries**: clsx and class-variance-authority for conditional CSS classes