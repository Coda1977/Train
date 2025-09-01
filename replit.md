# DrillMaster - Training Video Analyzer

## Overview

DrillMaster is a Progressive Web Application (PWA) designed for athletes and coaches to analyze, organize, and manage training drill videos. The application allows users to upload training videos, automatically process them for analysis, create workout routines by combining multiple drills, and track performance metrics. Built as a full-stack TypeScript application, it features a React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theming and dark mode support
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **PWA Features**: Service worker implementation with manifest for offline capabilities

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with JSON responses
- **Error Handling**: Centralized error middleware with structured error responses
- **Development**: Hot reload with Vite integration in development mode

### Data Layer
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema**: Two primary entities - drills and workouts with JSON fields for flexible data storage
- **Migrations**: Drizzle Kit for database schema management
- **Validation**: Zod schemas for runtime type validation matching database schema

### File Storage
- **Object Storage**: Google Cloud Storage integration via Replit sidecar
- **Access Control**: Custom ACL system for object-level permissions
- **Upload Strategy**: Direct-to-storage uploads with presigned URLs
- **File Serving**: Proxy endpoint for secure file access

### Authentication & Security
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **Object Access**: Custom ACL policy system with group-based permissions
- **Upload Security**: Controlled upload URLs with validation

### Development Environment
- **Build System**: Vite for frontend bundling and development server
- **Type Safety**: Shared TypeScript schemas between frontend and backend
- **Hot Reload**: Full-stack development with automatic reloading
- **Path Aliases**: Configured import aliases for clean code organization

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver for database connectivity
- **drizzle-orm & drizzle-kit**: Type-safe ORM with migration tools
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/***: Accessible UI primitive components
- **wouter**: Lightweight React router

### Development Tools
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Replit-specific development tooling
- **tsx**: TypeScript execution for development server

### File Upload & Storage
- **@google-cloud/storage**: Google Cloud Storage client
- **@uppy/core, @uppy/react, @uppy/aws-s3**: File upload interface and S3 compatibility
- **Replit Sidecar**: Authentication proxy for Google Cloud Storage

### UI & Styling
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library
- **embla-carousel-react**: Carousel component implementation

### Utilities
- **zod**: Runtime type validation
- **date-fns**: Date manipulation utilities
- **clsx & tailwind-merge**: Conditional class name utilities