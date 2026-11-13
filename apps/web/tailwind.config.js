/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#34206F",
          dark: "#2A1860",
          soft: "#EDE9F6",
          tint: "#F5F2FB"
        },
        accent: {
          violet: "#A89BD0"
        },
        page: "#FAF9FD",
        surface: "#FFFFFF",
        pastel: {
          lavender: "#D9CCF5",
          blue: "#F3F4FC",
          peach: "#FDE6D3",
          mint: "#E5F3EE"
        },
        heading: "#2A1860",
        body: "#4A4A5C",
        muted: "#8A8A9C",
        theme: "#E6E3EE",
        danger: {
          DEFAULT: "#D32F2F",
          tint: "#FDF1F1"
        },
        success: {
          DEFAULT: "#22C55E",
          tint: "#ECFDF5"
        },
        warning: {
          DEFAULT: "#D97706",
          tint: "#FFFBEB"
        }
      },
      fontFamily: {
        sans: [
          '"Lexend"',
          '"Outfit"',
          '"Poppins"',
          "system-ui",
          "-apple-system",
          "sans-serif"
        ]
      },
      borderRadius: {
        card: "24px",
        container: "28px",
        control: "14px",
        tile: "12px"
      },
      boxShadow: {
        "2xs": "0 1px 2px rgba(52, 32, 111, 0.04)",
        xs: "0 2px 6px rgba(52, 32, 111, 0.05)",
        soft: "0 8px 30px rgba(52, 32, 111, 0.08)",
        subtle: "0 4px 16px rgba(52, 32, 111, 0.05)",
        arrow: "0 4px 14px rgba(52, 32, 111, 0.12)"
      },
      backdropBlur: {
        xs: "2px"
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, #EDE6FA 0%, #F7E9F8 50%, #E8EEFD 100%)",
        "mint-fade": "linear-gradient(180deg, #FFFFFF 0%, #E5F3EE 100%)",
        "indigo-tile": "linear-gradient(135deg, #34206F 0%, #5839B0 100%)"
      }
    }
  },
  plugins: []
};
