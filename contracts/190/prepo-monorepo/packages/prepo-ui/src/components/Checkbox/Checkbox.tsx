import { Checkbox as ACheckbox, CheckboxProps } from 'antd'
import styled from 'styled-components'
import { media, spacingIncrement } from '../../common-utils'

/*
 Original code from IDO is simply : export const Checkbox = styled(ACheckbox)`...`;
 However if declarations:true in tsconfig.json, this outputs a ts error 4023 : Exported variable 'Checkbox' has or is using name 'CompoundedComponent' from external module "../node_modules/antd/lib/checkbox/index" but cannot be named.
 Most proposed workarounds are verbose and complicated, so I ended up forwarding the component this way
 see https://github.com/microsoft/TypeScript/issues/24666
*/

const StyledCheckbox = styled(ACheckbox)`
  .ant-checkbox-checked .ant-checkbox-inner {
    background-color: ${({ theme }): string => theme.color.primary};
  }

  .ant-checkbox-input:focus + .ant-checkbox-inner,
  .ant-checkbox-wrapper:hover .ant-checkbox-inner,
  .ant-checkbox-checked::after,
  .ant-checkbox:hover .ant-checkbox-inner {
    border-color: ${({ theme }): string => theme.color.primary};
  }
  &.ant-checkbox-wrapper {
    align-items: center;
    color: ${({ theme }): string => theme.color.neutral1};
    font-size: ${({ theme }): string => theme.fontSize.xs};
    font-weight: ${({ theme }): number => theme.fontWeight.medium};
    line-height: ${spacingIncrement(16)};
    ${media.desktop`
      font-size: ${({ theme }): string => theme.fontSize.base};
      line-height: ${spacingIncrement(21)};
    `}
  }
  .ant-checkbox {
    top: 0;
  }
  .ant-checkbox-inner {
    border: ${spacingIncrement(2)} solid ${({ theme }): string => theme.color.primary};
    height: ${spacingIncrement(18)};
    width: ${spacingIncrement(18)};
    ${media.desktop`
      height: ${spacingIncrement(24)};
      width: ${spacingIncrement(24)};
  `}
  }
  .ant-checkbox-inner::after {
    left: 25%;
  }
`

// eslint-disable-next-line react/jsx-props-no-spreading
const Checkbox: React.FC<CheckboxProps> = (props) => <StyledCheckbox {...props} />

export default Checkbox
