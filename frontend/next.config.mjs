/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Proxies API calls to the Flask backend so the browser sees one origin
    // and no CORS configuration is needed.
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:5000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
