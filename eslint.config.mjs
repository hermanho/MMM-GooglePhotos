import globals from "globals";
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";

export default [
    js.configs.recommended,
    jsdoc.configs['flat/recommended'],
    jsdoc.configs['flat/recommended-typescript-flavor'],
    {
        plugins: {
            jsdoc,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                Log: true,
                MM: true,
                Module: true,
                moment: true,
            },

            ecmaVersion: 13,
            sourceType: "module",

            parserOptions: {
                ecmaFeatures: {
                    globalReturn: true,
                },
            },
        },

        rules: {
            "comma-dangle": ["error", {
                arrays: "always-multiline",
                objects: "always-multiline",
                imports: "always-multiline",
                exports: "always-multiline",
                functions: "only-multiline",
            }],

            eqeqeq: "error",
            "no-prototype-builtins": "off",
            "no-unused-vars": "warn",
            "no-useless-return": "error",
            "no-var": "error",
            "jsdoc/require-returns": "off",
            "jsdoc/require-param-description": "off",
            semi: "error",
        },
    },
];