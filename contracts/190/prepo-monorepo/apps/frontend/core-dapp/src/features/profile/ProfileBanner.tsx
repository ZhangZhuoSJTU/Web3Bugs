import { Flex, Icon, IconName, Tooltip, Typography } from 'prepo-ui'
import styled, { Color } from 'styled-components'
import useResponsive from '../../hooks/useResponsive'

type BannerType = 'preacher' | 'elitePregen' | 'executive'

type Props =
  | {
      rankData?: { rank: number; percentile: number }
      type: 'elitePregen'
    }
  | {
      type: 'preacher' | 'executive'
      rankData?: undefined
    }

type BannerProperties = {
  title: 'Elite Pregen' | 'Executive' | 'Preacher'
  background: keyof Color
  icon: IconName
  iconBackground: keyof Color
  iconColor: keyof Color
  titleColor: keyof Color
  subtitleColor: keyof Color
  infoIconColor: keyof Color
  avatarColor: keyof Color
  tooltipText: string
}

type Banner = Record<BannerType, BannerProperties>

const bannerProperties: Banner = {
  elitePregen: {
    title: 'Elite Pregen', // title is variable based on how much PPO Power you have
    background: 'elitePregenBackground',
    icon: 'cup',
    iconBackground: 'preacherTextColor',
    iconColor: 'white',
    titleColor: 'white',
    subtitleColor: 'preacherTextColor',
    infoIconColor: 'white',
    avatarColor: 'preacherIconBackground',
    tooltipText: 'This is your PPO Power Rank (and Percentile).',
  },
  executive: {
    title: 'Executive',
    background: 'executiveBackground',
    icon: 'priest',
    iconBackground: 'executiveIconFill',
    iconColor: 'executiveIconFill',
    titleColor: 'executiveIconFill',
    subtitleColor: 'executiveIconFill',
    infoIconColor: 'executiveInfo',
    avatarColor: 'executiveBackground',
    tooltipText: 'This is your PPO Power Rank (and Percentile).',
  },
  preacher: {
    title: 'Preacher',
    background: 'preacherBackground',
    icon: 'priest',
    iconBackground: 'preacherIconFill',
    iconColor: 'white',
    titleColor: 'white',
    subtitleColor: 'preacherTextColor',
    infoIconColor: 'white',
    avatarColor: 'white',
    tooltipText: 'This is your PPO Power Rank (and Percentile).',
  },
}

const StyledInfoIcon = styled(Icon)<{ $type: BannerType }>`
  * {
    fill: ${({ $type, theme: { color } }): string => color[bannerProperties[$type].infoIconColor]};
  }
`

const StyledIcon = styled(Icon)<{ $type: BannerType }>`
  * {
    fill: ${({ $type, theme: { color } }): string => color[bannerProperties[$type].avatarColor]};
  }
`

const ProfileBanner: React.FC<Props> = ({ type, rankData }) => {
  const { isDesktop } = useResponsive()
  const size = isDesktop ? '24' : '14'
  const wrapperSize = isDesktop ? 59 : 33
  const { background, iconBackground, icon, titleColor, title, tooltipText, subtitleColor } =
    bannerProperties[type]

  return (
    <Flex
      justifyContent="space-between"
      background={background}
      filter="drop-shadow(0px 0px 16px rgba(98, 100, 216, 0.25))"
      borderRadius={4}
      px={23}
      py={{ desktop: 20.5, phone: rankData ? 12.5 : 8.5 }}
    >
      <Flex background={iconBackground} width={wrapperSize} height={wrapperSize} borderRadius="50%">
        <StyledIcon $type={type} name={icon} width={size} height={size} />
      </Flex>
      <Flex flexDirection="column" gap={{ desktop: 8, phone: 4 }}>
        <Typography
          variant="text-semiBold-xl"
          color={titleColor}
          display="flex"
          alignItems="center"
          gap={10}
        >
          {title}
          <Flex>
            <Tooltip title={tooltipText}>
              <Flex>
                <StyledInfoIcon $type={type} name="info" width={size} height={size} />
              </Flex>
            </Tooltip>
          </Flex>
        </Typography>
        {rankData && (
          <Typography variant="text-medium-base" color={subtitleColor} display="flex">
            <Flex display={{ desktop: 'flex', phone: 'none' }}>Your PPO Power Rank&nbsp;</Flex> #
            {rankData.rank} (${rankData.percentile}%).
          </Typography>
        )}
      </Flex>
      <Flex width={wrapperSize} />
    </Flex>
  )
}

export default ProfileBanner
