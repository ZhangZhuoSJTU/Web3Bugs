const NonBreakingText: React.FC<{ className?: string }> = ({ children, className }) => (
  <span className={`whitespace-nowrap ${className}`}>{children}</span>
)

export default NonBreakingText
