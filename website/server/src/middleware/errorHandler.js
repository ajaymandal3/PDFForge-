function errorHandler(error, _req, res, _next) {
  console.error(error);
  res.status(error.statusCode || 500).json({
    ok: false,
    message: error.message || 'Internal server error',
  });
}

module.exports = { errorHandler };
