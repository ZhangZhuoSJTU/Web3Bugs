import { spacingIncrement, media } from 'prepo-ui'
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon'
import styled from 'styled-components'

type Props = {
  account: string
  avatarUrl?: string
  diameterDesktop?: number
  diameterMobile?: number
}

type ComponentProps = {
  diameterDesktop: number
  diameterMobile: number
  seed?: number
  avatarUrl?: string
}

/*
  Jazzicon component is not re-rendering after diameter prop is changed
  We need to modify the style of the component manually using css instead
  We have to use the `!important` tag to make sure that the width/height provided will be used
*/

const Wrapper = styled.div<ComponentProps>`
  align-items: center;
  background-image: url(${({ avatarUrl }): string | undefined => avatarUrl});
  background-position: top center;
  background-size: cover;
  display: flex;
  height: ${({ diameterMobile }): string => spacingIncrement(diameterMobile)};
  justify-content: center;
  width: ${({ diameterMobile }): string => spacingIncrement(diameterMobile)};

  .paper {
    height: ${({ diameterMobile }): string => spacingIncrement(diameterMobile)} !important;
    width: ${({ diameterMobile }): string => spacingIncrement(diameterMobile)} !important;
  }

  ${media.desktop<Pick<ComponentProps, 'diameterDesktop'>>`
    width: ${({ diameterDesktop }): string => spacingIncrement(diameterDesktop)};
    height: ${({ diameterDesktop }): string => spacingIncrement(diameterDesktop)};
     .paper {
      height: ${({ diameterDesktop }): string => spacingIncrement(diameterDesktop)} !important;
      width: ${({ diameterDesktop }): string => spacingIncrement(diameterDesktop)} !important;
    }
  `}
`

const Identicon: React.FC<Props> = ({
  account,
  diameterDesktop = 15,
  diameterMobile = 15,
  avatarUrl,
}) => {
  if (!account) return null
  if (avatarUrl) {
    return (
      <Wrapper
        diameterDesktop={diameterDesktop}
        diameterMobile={diameterMobile}
        avatarUrl={avatarUrl}
      />
    )
  }

  return (
    <Wrapper diameterDesktop={diameterDesktop} diameterMobile={diameterMobile}>
      <Jazzicon diameter={diameterDesktop} seed={jsNumberForAddress(account)} />
    </Wrapper>
  )
}

export default Identicon
