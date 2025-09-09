export default function TestPage() {
  return (
    <div>
      <h1>Test Page</h1>
      <p>If you can see this, authentication is working!</p>
      <p>Current time: {new Date().toISOString()}</p>
    </div>
  )
}