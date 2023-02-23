import { Flex, Icon, IconName, Typography } from 'prepo-ui'
import styled, { Color } from 'styled-components'
import useResponsive from '../../hooks/useResponsive'

export const loadValue = (
  value?: React.ReactNode,
  suffix = '',
  connected = true
): number | string | JSX.Element =>
  value === undefined || !connected ? (
    '-'
  ) : (
    <>
      {value}
      {suffix}
    </>
  )

const Wrapper = styled(Flex)`
  border-bottom: 1px solid ${({ theme }): string => theme.color.accentPrimary};
  :last-child {
    border: none;
  }
`

const Details: React.FC<{
  iconName?: IconName
  title: React.ReactNode
  value?: React.ReactNode
  description?: React.ReactNode
  options?: { titleColor?: keyof Color; descriptionColor?: keyof Color }
}> = ({ title, value, description, iconName, options }) => {
  const { isLargeDesktop } = useResponsive()
  const size = isLargeDesktop ? '34' : '24'

  return (
    <Wrapper
      justifyContent="space-between"
      py={14}
      pl={{ phone: 21, desktop: 46 }}
      pr={{ phone: 22, desktop: 35 }}
    >
      <Flex gap={{ phone: 11, desktop: 15 }} justifyContent="flex" as="span">
        {iconName && <Icon name={iconName} width={size} height={size} />}
        <Flex flexDirection="column" alignItems="flex-start" gap={{ desktop: 8, phone: 4 }}>
          <Typography
            variant="text-medium-md"
            color={options?.titleColor ?? 'neutral1'}
            as="h5"
            display="flex"
            alignItems="center"
            flexDirection="column"
            mb="0"
          >
            {title}
          </Typography>
          {description && (
            <Typography
              variant="text-medium-base"
              color={options?.descriptionColor ?? 'neutral3'}
              gap={{ desktop: 8, phone: 4 }}
              display="flex"
              flexDirection="column"
              as="p"
              mb="0"
            >
              {description}
            </Typography>
          )}
        </Flex>
      </Flex>
      <Typography variant="text-semiBold-xl" color="neutral1">
        {loadValue(value)}
      </Typography>
    </Wrapper>
  )
}

export default Details
