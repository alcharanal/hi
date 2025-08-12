const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Anon-Connect API',
    version: '1.0.0',
    description: 'Anonymous Chat Platform API with AI Integration',
    contact: {
      name: 'Anon-Connect Support',
      email: 'support@anon-connect.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3002',
      description: 'Development server'
    },
    {
      url: 'https://api.anon-connect.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for user authentication'
      },
      adminAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for admin authentication'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'User ID',
            example: 1
          },
          username: {
            type: 'string',
            description: 'Username',
            example: 'john_doe'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address',
            example: 'john@example.com'
          },
          anonymous_name: {
            type: 'string',
            description: 'Anonymous display name',
            example: 'Silent Wolf'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the user account is active'
          }
        }
      },
      Chat: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Chat ID'
          },
          user1_anonymous: {
            type: 'string',
            description: 'Anonymous name of first user'
          },
          user2_anonymous: {
            type: 'string',
            description: 'Anonymous name of second user'
          },
          status: {
            type: 'string',
            enum: ['active', 'ended', 'terminated'],
            description: 'Chat status'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Chat creation timestamp'
          },
          message_count: {
            type: 'integer',
            description: 'Number of messages in chat'
          }
        }
      },
      Message: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Message ID'
          },
          chat_id: {
            type: 'integer',
            description: 'Chat ID this message belongs to'
          },
          sender_anonymous: {
            type: 'string',
            description: 'Anonymous name of sender'
          },
          content: {
            type: 'string',
            description: 'Message content'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Message timestamp'
          },
          message_type: {
            type: 'string',
            enum: ['text', 'system', 'ai_suggestion'],
            description: 'Type of message'
          }
        }
      },
      AIInsight: {
        type: 'object',
        properties: {
          mood: {
            type: 'object',
            properties: {
              primary: {
                type: 'string',
                description: 'Primary mood detected'
              },
              confidence: {
                type: 'number',
                format: 'float',
                description: 'Confidence score (0-1)'
              }
            }
          },
          compatibility: {
            type: 'object',
            properties: {
              score: {
                type: 'number',
                format: 'float',
                description: 'Compatibility score (0-100)'
              },
              factors: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Factors contributing to compatibility'
              }
            }
          },
          suggestions: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Conversation suggestions'
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            description: 'Error message'
          },
          errors: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Detailed error list'
          }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          message: {
            type: 'string',
            description: 'Success message'
          },
          data: {
            type: 'object',
            description: 'Response data'
          }
        }
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              message: 'Authentication required'
            }
          }
        }
      },
      ForbiddenError: {
        description: 'Access denied',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              message: 'Access denied'
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              message: 'Resource not found'
            }
          }
        }
      },
      ValidationError: {
        description: 'Invalid input data',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              message: 'Invalid input data',
              errors: ['Username is required', 'Email format is invalid']
            }
          }
        }
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              message: 'Rate limit exceeded',
              retryAfter: '15 minutes'
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization'
    },
    {
      name: 'Chat',
      description: 'Chat system and messaging'
    },
    {
      name: 'AI',
      description: 'AI-powered features and insights'
    },
    {
      name: 'Admin',
      description: 'Administrative functions'
    },
    {
      name: 'System',
      description: 'System health and monitoring'
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check endpoint',
        description: 'Check if the API is running and healthy',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Success'
                },
                example: {
                  success: true,
                  message: 'Service is healthy',
                  data: {
                    status: 'ok',
                    timestamp: '2024-01-01T00:00:00.000Z',
                    uptime: 3600
                  }
                }
              }
            }
          }
        }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        description: 'Create a new user account with username, email, and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: {
                    type: 'string',
                    minLength: 3,
                    maxLength: 30,
                    pattern: '^[a-zA-Z0-9_-]+$',
                    description: 'Username (3-30 characters, alphanumeric, underscore, hyphen)',
                    example: 'john_doe'
                  },
                  email: {
                    type: 'string',
                    format: 'email',
                    description: 'Valid email address',
                    example: 'john@example.com'
                  },
                  password: {
                    type: 'string',
                    minLength: 8,
                    description: 'Password (minimum 8 characters, must contain uppercase, lowercase, number, and special character)',
                    example: 'SecurePass123!'
                  }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Success'
                },
                example: {
                  success: true,
                  message: 'User registered successfully',
                  data: {
                    user: {
                      id: 1,
                      username: 'john_doe',
                      email: 'john@example.com',
                      anonymous_name: 'Silent Wolf'
                    }
                  }
                }
              }
            }
          },
          400: {
            $ref: '#/components/responses/ValidationError'
          },
          429: {
            $ref: '#/components/responses/RateLimitError'
          }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticate user and receive JWT tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: {
                    type: 'string',
                    description: 'Username or email',
                    example: 'john_doe'
                  },
                  password: {
                    type: 'string',
                    description: 'User password',
                    example: 'SecurePass123!'
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    message: {
                      type: 'string',
                      example: 'Login successful'
                    },
                    access_token: {
                      type: 'string',
                      description: 'JWT access token'
                    },
                    refresh_token: {
                      type: 'string',
                      description: 'JWT refresh token'
                    },
                    token_type: {
                      type: 'string',
                      example: 'bearer'
                    },
                    expires_in: {
                      type: 'string',
                      example: '1h'
                    },
                    user: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/UnauthorizedError'
          },
          429: {
            $ref: '#/components/responses/RateLimitError'
          }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user info',
        description: 'Get information about the currently authenticated user',
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          200: {
            description: 'User information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/UnauthorizedError'
          }
        }
      }
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Use refresh token to get a new access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: {
                  refresh_token: {
                    type: 'string',
                    description: 'Valid refresh token'
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    access_token: {
                      type: 'string',
                      description: 'New JWT access token'
                    },
                    token_type: {
                      type: 'string',
                      example: 'bearer'
                    },
                    expires_in: {
                      type: 'string',
                      example: '1h'
                    }
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/UnauthorizedError'
          }
        }
      }
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'User logout',
        description: 'Logout user and revoke refresh token',
        security: [
          {
            bearerAuth: []
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refresh_token: {
                    type: 'string',
                    description: 'Refresh token to revoke'
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Success'
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/UnauthorizedError'
          }
        }
      }
    },
    '/chat/stats': {
      get: {
        tags: ['Chat'],
        summary: 'Get chat statistics',
        description: 'Get real-time chat system statistics',
        responses: {
          200: {
            description: 'Chat statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        activeConnections: {
                          type: 'integer',
                          description: 'Number of active connections'
                        },
                        waitingQueue: {
                          type: 'integer',
                          description: 'Users waiting for a match'
                        },
                        activeRooms: {
                          type: 'integer',
                          description: 'Number of active chat rooms'
                        },
                        totalMessages: {
                          type: 'integer',
                          description: 'Total messages sent today'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/admin/login': {
      post: {
        tags: ['Admin'],
        summary: 'Admin login',
        description: 'Authenticate admin user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: {
                    type: 'string',
                    description: 'Admin username'
                  },
                  password: {
                    type: 'string',
                    description: 'Admin password'
                  },
                  ipAddress: {
                    type: 'string',
                    description: 'Client IP address'
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Admin login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    token: {
                      type: 'string',
                      description: 'Admin JWT token'
                    },
                    admin: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'integer'
                        },
                        username: {
                          type: 'string'
                        },
                        role: {
                          type: 'string'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/UnauthorizedError'
          },
          429: {
            $ref: '#/components/responses/RateLimitError'
          }
        }
      }
    },
    '/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin dashboard statistics',
        description: 'Get comprehensive system statistics for admin dashboard',
        security: [
          {
            adminAuth: []
          }
        ],
        responses: {
          200: {
            description: 'Admin statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalUsers: {
                      type: 'integer'
                    },
                    activeUsers: {
                      type: 'integer'
                    },
                    activeChats: {
                      type: 'integer'
                    },
                    messagesToday: {
                      type: 'integer'
                    },
                    newUsersWeek: {
                      type: 'integer'
                    }
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/UnauthorizedError'
          },
          403: {
            $ref: '#/components/responses/ForbiddenError'
          }
        }
      }
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Get users list',
        description: 'Get paginated list of users with filtering',
        security: [
          {
            adminAuth: []
          }
        ],
        parameters: [
          {
            name: 'filter',
            in: 'query',
            description: 'Filter users by status',
            schema: {
              type: 'string',
              enum: ['all', 'active', 'banned'],
              default: 'all'
            }
          },
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: {
              type: 'integer',
              minimum: 1,
              default: 1
            }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of users per page',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50
            }
          }
        ],
        responses: {
          200: {
            description: 'Users list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/User'
                      }
                    },
                    total: {
                      type: 'integer'
                    },
                    page: {
                      type: 'integer'
                    },
                    limit: {
                      type: 'integer'
                    }
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/UnauthorizedError'
          },
          403: {
            $ref: '#/components/responses/ForbiddenError'
          }
        }
      }
    },
    '/admin/system/health': {
      get: {
        tags: ['Admin'],
        summary: 'Get system health status',
        description: 'Get detailed system health information',
        security: [
          {
            adminAuth: []
          }
        ],
        responses: {
          200: {
            description: 'System health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    overall: {
                      type: 'string',
                      enum: ['healthy', 'warning', 'critical']
                    },
                    uptime: {
                      type: 'string',
                      description: 'System uptime'
                    },
                    lastCheck: {
                      type: 'string',
                      format: 'date-time'
                    },
                    checks: {
                      type: 'object',
                      properties: {
                        database: {
                          type: 'object',
                          properties: {
                            status: {
                              type: 'string'
                            },
                            responseTime: {
                              type: 'number'
                            }
                          }
                        },
                        memory: {
                          type: 'object',
                          properties: {
                            status: {
                              type: 'string'
                            },
                            usage: {
                              type: 'number'
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/UnauthorizedError'
          },
          403: {
            $ref: '#/components/responses/ForbiddenError'
          }
        }
      }
    }
  }
};

// Options for the swagger docs
const options = {
  definition: swaggerDefinition,
  apis: ['./server.js', './routes/*.js'], // paths to files containing OpenAPI definitions
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

module.exports = {
  swaggerSpec,
  swaggerUi,
  setupSwagger: (app) => {
    // Serve swagger docs
    app.use('/api/docs', swaggerUi.serve);
    app.get('/api/docs', swaggerUi.setup(swaggerSpec, {
      customCss: `
        .topbar-wrapper img { content: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzY2NjZmMSIvPgo8cGF0aCBkPSJNOSAxNkExIDEgMCAwIDEgMTAgMTVIMjJBMSAxIDAgMCAxIDIzIDE2VjIyQTEgMSAwIDAgMSAyMiAyM0gxMEExIDEgMCAwIDEgOSAyMlYxNloiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjEzIiBjeT0iMTkiIHI9IjIiIGZpbGw9IiM2NjY2ZjEiLz4KPHN2Zz4K'); }
        .topbar-wrapper .link { color: #6366f1; }
        .swagger-ui .topbar { background-color: #6366f1; }
        .swagger-ui .topbar .download-url-wrapper .select-label { color: white; }
        .swagger-ui .topbar .download-url-wrapper input[type=text] { border: 2px solid #4f46e5; }
      `,
      customSiteTitle: 'Anon-Connect API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        showRequestHeaders: true,
        showCommonExtensions: true,
        tryItOutEnabled: true
      }
    }));

    // Serve swagger spec as JSON
    app.get('/api/docs/swagger.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    console.log('📚 API Documentation available at /api/docs');
  }
};
