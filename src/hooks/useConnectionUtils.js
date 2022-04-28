import { useWeb3React } from '@web3-react/core';
import { ethers } from 'ethers';
export default () => {
    const { connector } = useWeb3React();

    const getSigner = async () => {
        const web3provider = await connector.getProvider();
        let provider = new ethers.providers.Web3Provider(web3provider);
        const signer = provider.getSigner();
        return signer;
    };

    const getHigherGWEI = async () => {

        const web3provider = await connector.getProvider();
        const provider = new ethers.providers.Web3Provider(web3provider);
        const price = (await provider.getGasPrice()) * 2;

        return price;
    };
    return { getHigherGWEI, getSigner }
}

