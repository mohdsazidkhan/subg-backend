const Joi = require('joi');

// User registration validation
const validateUserRegistration = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
      'string.pattern.base': 'Phone number must be exactly 10 digits',
      'any.required': 'Phone number is required'
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),
    role: Joi.string().valid('student', 'admin').default('student')
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      message: error.details[0].message,
      field: error.details[0].path[0]
    });
  }
  next();
};

// User login validation
const validateUserLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      message: error.details[0].message,
      field: error.details[0].path[0]
    });
  }
  next();
};



module.exports = {
  validateUserRegistration,
  validateUserLogin
}; 