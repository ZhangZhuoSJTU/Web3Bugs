import { css } from 'styled-components'
import { coreDappTheme, spacingIncrement } from 'prepo-ui'

const { Z_INDEX } = coreDappTheme

export default css`
  .bn-onboard-custom {
    color: ${({ theme }): string => theme.color.secondary} !important;
    font-family: ${({ theme }): string => theme.fontFamily.primary} !important;
    z-index: ${Z_INDEX.navigation};
    .bn-onboard-modal-content {
      border-radius: ${({ theme }): string => theme.borderRadius.xs};
      background-color: ${({ theme }): string => theme.color.neutral9};
    }
    .bn-onboard-modal-content-header {
      margin-bottom: 0 !important;
    }
    .bn-onboard-modal-content-header-icon {
      display: none;
    }
    .bn-onboard-modal-content-header-heading {
      padding-top: ${spacingIncrement(60)};
      margin-left: ${spacingIncrement(20)};
      font-size: ${({ theme }): string => theme.fontSize.md};
      font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
    }
    .bn-onboard-select-description {
      padding-top: 0 !important;
      margin-top: ${spacingIncrement(7)} !important;
      margin-left: ${spacingIncrement(20)} !important;
      font-size: ${({ theme }): string => theme.fontSize.xs};
    }
    .bn-onboard-prepare-description {
      padding-top: 0 !important;
      margin-top: ${spacingIncrement(7)} !important;
      margin-left: ${spacingIncrement(20)} !important;
      font-size: ${({ theme }): string => theme.fontSize.xs};
    }
    .bn-onboard-icon-button {
      padding-left: ${spacingIncrement(24)};
      span {
        flex: 1;
        margin-left: ${spacingIncrement(30)};
        font-size: ${({ theme }): string => theme.fontSize.sm};
      }
    }
    .bn-onboard-select-info-container {
      display: none !important;
    }
    .bn-branding {
      display: none !important;
    }
    .bn-onboard-prepare-button:hover {
      background-color: ${({ theme }): string => theme.color.neutral7} !important;
    }
    .bn-onboard-prepare-button-container {
      padding: ${spacingIncrement(20)} 0 ${spacingIncrement(20)} 0;
    }
    .bn-onboard-prepare-error {
      margin: ${spacingIncrement(20)} ${spacingIncrement(20)} 0 ${spacingIncrement(20)};
    }
    .bn-onboard-prepare-button-right {
      margin-right: ${spacingIncrement(20)};
    }
  }
`
