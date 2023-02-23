import { ButtonProps } from 'prepo-ui'
import TransactionSummaryLayout from '../Layout'

type Props = {
  button: ButtonProps
}
const DefaultContent: React.FC<Props> = ({ button, children }) => (
  <TransactionSummaryLayout button={button}>{children ?? 'Confirm'}</TransactionSummaryLayout>
)

export default DefaultContent
