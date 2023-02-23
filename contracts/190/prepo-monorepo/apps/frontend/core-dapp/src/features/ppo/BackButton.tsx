import { Icon } from 'prepo-ui'
import styled from 'styled-components'
import Link from '../../components/Link'
import useResponsive from '../../hooks/useResponsive'

type Props = {
  href: string
}

const Anchor = styled(Link)`
  display: flex;
  line-height: 1;
`

const BackButton: React.FC<Props> = ({ href }) => {
  const { isDesktop } = useResponsive()
  const size = isDesktop ? '36' : '24'
  return (
    <Anchor href={href}>
      <Icon name="arrow-left" color="neutral1" height={size} width={size} />
    </Anchor>
  )
}

export default BackButton
