import { forwardRef, Ref } from 'react'
import { Radio, RadioGroupProps } from 'antd'
import styled from 'styled-components'
import { spacingIncrement, media } from 'prepo-ui'

type Props = RadioGroupProps & {
  ref?: Ref<HTMLDivElement> | undefined
  label?: string
  disabled?: boolean
  childRadioGroup?: React.ReactNode
}

const RadioGroupWrapper = styled(Radio.Group)<Props>`
  display: ${({ childRadioGroup }): string => (childRadioGroup ? 'block' : 'flex')};
  margin: 0;
  opacity: ${({ disabled }): string => (disabled ? '0.8' : '1')};
  white-space: nowrap;
  width: 100%;

  > label {
    flex-grow: 1;
    margin: 0;
    margin-right: ${spacingIncrement(12)};
    width: 100%;

    &:last-child {
      margin-right: 0;
    }
  }

  &&& {
    .ant-radio-wrapper {
      background-color: ${({ theme }): string => theme.color.neutral9};
      border: 1px solid ${({ theme }): string => theme.color.neutral8};
      /* Stop height glitching when border gets 1px larger by adding 1px to padding when not checked */
      border-radius: ${({ theme }): string => theme.borderRadius.base};
      padding: calc(0.75rem);
    }

    .ant-radio-wrapper-checked {
      font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
      padding: 0.75rem;
    }

    span {
      background-color: ${({ theme }): string => theme.color.neutral9};
    }
    .ant-radio-inner {
      border-color: ${({ theme }): string => theme.color.neutral7};
    }

    .ant-radio-checked .ant-radio-inner,
    .ant-radio-checked .ant-radio-inner:focus,
    .ant-radio-input:focus + .ant-radio-inner,
    .ant-radio:hover .ant-radio-inner {
      border-color: ${({ theme }): string => theme.color.primary};
    }

    .ant-radio-checked .ant-radio-inner:after {
      background-color: ${({ theme }): string => theme.color.primary};
    }
  }
`

const Label = styled.div<{ disabled?: boolean }>`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-bottom: ${spacingIncrement(8)};
  opacity: ${({ disabled }): string => (disabled ? '0.4' : '1')};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const SpecialChildrenWrapper = styled.div`
  display: flex;

  > label {
    flex-grow: 1;
    margin: 0;
    margin-right: 0.5rem;
    width: 100%;

    &:last-child {
      margin-right: 0;
    }
  }
`

const RadioGroup: React.FC<Props> = forwardRef(
  (
    { label, disabled, value, childRadioGroup, children, ...props },
    ref: Ref<HTMLDivElement> | undefined
  ) => {
    const renderChildRadioGroup = (): React.ReactNode => {
      if (!childRadioGroup) {
        return null
      }

      return (
        <>
          <hr style={{ margin: '0.5rem' }} />
          {childRadioGroup}
        </>
      )
    }

    const renderChildren = (): React.ReactNode => {
      if (!childRadioGroup) {
        return children
      }

      return <SpecialChildrenWrapper>{children}</SpecialChildrenWrapper>
    }

    return (
      <>
        {label !== undefined ? <Label disabled={disabled}>{label}</Label> : null}
        <RadioGroupWrapper
          ref={ref}
          childRadioGroup={childRadioGroup}
          disabled={disabled}
          value={value}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...props}
        >
          <>
            {renderChildren()}
            {renderChildRadioGroup()}
          </>
        </RadioGroupWrapper>
      </>
    )
  }
)

RadioGroup.displayName = 'RadioGroup'

export default RadioGroup
