import { Flex, media, Subtitle, Typography } from 'prepo-ui'
import { ReactElement } from 'react'
import Skeleton from 'react-loading-skeleton'
import styled from 'styled-components'

type Props = {
  icon: ReactElement
  title: string
  tooltipText?: string
  value?: number
  loading: boolean
  suffix?: string
}

const Title = styled(Subtitle)`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  overflow: hidden;
  white-space: nowrap;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const PpoBox: React.FC<Props> = ({ title, icon, value, suffix = '', tooltipText, loading }) => (
  <Flex
    flex={1}
    gap={{ desktop: 12, phone: 8 }}
    alignItems="flex-start"
    py={{ desktop: 35, phone: 13 }}
    pl={{ desktop: 0, phone: 21 }}
    flexDirection={{ desktop: 'row', phone: 'column' }}
  >
    {icon}
    <Flex flexDirection="column" gap={{ desktop: 10, phone: 8 }} alignItems="flex-start">
      <Title tooltip={tooltipText}>{title}</Title>
      {loading ? (
        <Skeleton height={25} width={70} />
      ) : (
        <Typography variant="text-semiBold-xl" color="neutral1">
          {(value ?? '-').toLocaleString()} {suffix}
        </Typography>
      )}
    </Flex>
  </Flex>
)

export default PpoBox
